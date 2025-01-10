from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import List, Dict
from datetime import datetime
from google.cloud import dataplex_v1
from google.api_core import retry, exceptions as google_exceptions
from pydantic import BaseModel
from google.auth import default
import logging
from collections import defaultdict
from google.cloud.dataplex_v1.types import (
    GetDataScanRequest,
    ListDataScanJobsRequest,
    GetDataScanJobRequest,
    DataScanJob,
)

from google.cloud import datacatalog_lineage_v1
import re
from google.cloud import bigquery
from google.api_core.exceptions import NotFound
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DataplexConfig(BaseModel):
    project_id: str
    location: str


def is_bigquery_entry(entry: dataplex_v1.Entry) -> bool:
    """Check if the entry is from BigQuery"""
    return (
        hasattr(entry, "entry_source")
        and hasattr(entry.entry_source, "system")
        and entry.entry_source.system.upper() == "BIGQUERY"
    )


def get_data_product_name(entry: dataplex_v1.Entry) -> str:
    """Extract data product name from entry labels"""
    if (
        hasattr(entry, "entry_source")
        and hasattr(entry.entry_source, "labels")
        and "dataproduct-name" in entry.entry_source.labels
    ):
        return entry.entry_source.labels["dataproduct-name"]
    return None


def transform_dataplex_entry(entry: dataplex_v1.Entry) -> Dict:
    """Transform a Dataplex entry into our component format"""
    entry_source = entry.entry_source if hasattr(entry, "entry_source") else None

    return {
        "id": entry.name.split("/")[-1],
        "name": (
            entry_source.display_name
            if entry_source and hasattr(entry_source, "display_name")
            else entry.name.split("/")[-1]
        ),
        "type": (
            entry.entry_type.split("/")[-1]
            if entry and hasattr(entry, "entry_type")
            else "Unknown"
        ),
        "created_at": (
            entry_source.create_time.isoformat()
            if entry_source and hasattr(entry_source, "create_time")
            else datetime.now().isoformat()
        ),
        "source": {
            "system": (
                entry_source.system
                if entry_source and hasattr(entry_source, "system")
                else "Unknown"
            ),
            "resource": (
                entry_source.resource
                if entry_source and hasattr(entry_source, "resource")
                else ""
            ),
            "labels": (
                entry_source.labels
                if entry_source and hasattr(entry_source, "labels")
                else {}
            ),
        },
        "labels": (
            entry_source.labels
            if entry_source and hasattr(entry_source, "labels")
            else {}
        ),
    }


def transform_data_product(name: str, components: List[Dict]) -> Dict:
    """Transform a collection of entries into a data product"""
    # Get the first component that has a dataproduct-kind label, or
    # default to source-aligned
    data_product_kind = next(
        (
            comp["labels"].get("dataproduct-kind", "source-aligned")
            for comp in components
            if "dataproduct-kind" in comp.get("labels", {})
        ),
        next(
            (
                comp.get("source", {})
                .get("labels", {})
                .get("dataproduct-kind", "source-aligned")
                for comp in components
            ),
            "source-aligned",
        ),
    )

    # Get team from dataproduct-team label
    team = next(
        (
            comp["labels"].get("dataproduct-team", "Unassigned")
            for comp in components
            if "dataproduct-team" in comp.get("labels", {})
        ),
        next(
            (
                comp.get("source", {})
                .get("labels", {})
                .get("dataproduct-team", "Unassigned")
                for comp in components
            ),
            "Unassigned",
        ),
    )

    return {
        "id": name,
        "name": name,
        "kind": data_product_kind,
        "team": team,
        "components": components,
        "tags": list(
            set(
                tag
                for comp in components
                for tag in comp.get("labels", {}).values()
                if tag != name
                and tag != data_product_kind
                and tag != team  # Also exclude team from tags
            )
        ),
        "created_at": min(
            (comp["created_at"] for comp in components),
            default=datetime.now().isoformat(),
        ),
    }


@app.get("/api/data-products")
async def get_data_products(project_id: str, location: str):
    try:
        # Get default credentials
        credentials, _ = default()

        # Initialize the Dataplex client with credentials
        client = dataplex_v1.CatalogServiceClient(credentials=credentials)

        # First, list all entry groups in the location
        parent_location = f"projects/{project_id}/locations/{location}"
        # logger.info(f"Listing entry groups in: {parent_location}")

        try:
            # Get all entry groups
            entry_groups_request = dataplex_v1.ListEntryGroupsRequest(
                parent=parent_location
            )
            entry_groups_iterator = client.list_entry_groups(
                request=entry_groups_request
            )

            # Group entries by data product name
            data_product_components = defaultdict(list)

            # Iterate through each entry group
            for entry_group in entry_groups_iterator:
                # logger.info(f"Processing entry group: {entry_group.name}")

                # List entries in this entry group
                @retry.Retry(
                    predicate=retry.if_exception_type(
                        google_exceptions.ServiceUnavailable
                    )
                )
                def list_entries():
                    request = dataplex_v1.ListEntriesRequest(
                        parent=entry_group.name,
                        page_size=100,
                    )
                    return client.list_entries(request=request)

                try:
                    # Get entries for this group
                    entries_iterator = list_entries()

                    for entry in entries_iterator:
                        try:
                            # Only process BigQuery entries that belong
                            # to a data product
                            if is_bigquery_entry(entry):
                                data_product_name = get_data_product_name(entry)
                                if data_product_name:
                                    # logger.info(
                                    #     "Processing component for data "
                                    #     f"product '{data_product_name}': "
                                    #     f"{entry.name}"
                                    # )
                                    component = transform_dataplex_entry(entry)
                                    data_product_components[data_product_name].append(
                                        component
                                    )
                                else:
                                    logger.debug(
                                        "Skipping entry without data "
                                        f"product label: {entry.name}"
                                    )
                            else:
                                logger.debug(
                                    "Skipping non-BigQuery entry: " f"{entry.name}"
                                )
                        except Exception as transform_error:
                            logger.error(
                                "Error transforming entry "
                                f"{entry.name}: {str(transform_error)}"
                            )
                            continue

                except google_exceptions.PermissionDenied as e:
                    logger.warning(
                        "Permission denied for entry group "
                        f"{entry_group.name}: {str(e)}"
                    )
                    continue
                except Exception as e:
                    logger.error(
                        "Error processing entry group " f"{entry_group.name}: {str(e)}"
                    )
                    continue

            # Transform components into data products
            data_products = [
                transform_data_product(name, components)
                for name, components in data_product_components.items()
            ]

            # logger.info(
            #     "Successfully fetched "
            #     f"{len(data_products)} data products with "
            #     f"{sum(len(dp['components']) for dp in data_products)} "
            #     "total components"
            # )
            return {"data_products": data_products}

        except google_exceptions.PermissionDenied as e:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied accessing Dataplex: {str(e)}",
            )
        except google_exceptions.NotFound as e:
            raise HTTPException(
                status_code=404,
                detail=f"Project or location not found: {str(e)}",
            )
        except Exception as e:
            logger.error(f"Error fetching from Dataplex: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching from Dataplex: {str(e)}",
            )

    except Exception as e:
        logger.error(f"Error connecting to Dataplex: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error connecting to Dataplex: {str(e)}"
        )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def _get_table_schema(table_fqn, project_id):
    """Get schema information for a BigQuery table using the BigQuery client"""
    try:
        client = bigquery.Client(project=project_id)
        table = client.get_table(table_fqn)

        schema_fields = []
        for field in table.schema:
            schema_fields.append(
                {
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description or "",
                }
            )

        return {"fields": schema_fields, "description": table.description or ""}
    except NotFound:
        logger.error(f"Table {table_fqn} not found")
        return None
    except Exception as e:
        logger.error(f"Error fetching schema for {table_fqn}: {str(e)}")
        return None


@app.get("/api/data-products/{table_id}/profile")
async def get_table_profile(table_id: str, project_id: str, location: str):
    """Get profile and quality information for a BigQuery table"""
    try:
        # Find the table entry to get the correct dataset (existing code)
        catalog_client = dataplex_v1.CatalogServiceClient()
        parent = f"projects/{project_id}/locations/{location}/entryGroups/@bigquery"
        request = dataplex_v1.ListEntriesRequest(parent=parent)
        entries = catalog_client.list_entries(request=request)

        table_entry = None
        for entry in entries:
            if table_id in entry.name and entry.name.endswith(f"/tables/{table_id}"):
                table_entry = entry
                break

        if not table_entry:
            logger.warning(f"No matching entry found for table_id: {table_id}")
            return {"data_profile": [], "data_quality": [], "schema": None}

        # Extract dataset from the entry resource
        resource_parts = table_entry.entry_source.resource.split("/")
        dataset_id = resource_parts[-3]

        # Construct the fully qualified name
        table_fqn = f"{project_id}.{dataset_id}.{table_id}"

        # Get schema information
        schema_info = _get_table_schema(table_fqn, project_id)

        # Get existing profile and quality data
        scan_client = dataplex_v1.DataScanServiceClient()
        results = _get_table_profile_quality(
            True, table_fqn, project_id, location, scan_client
        )

        # Add schema information to the response
        return {
            "data_profile": results["data_profile"],
            "data_quality": results["data_quality"],
            "schema": schema_info,
        }

    except Exception as e:
        logger.error(f"Error getting table profile: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error getting table profile: {str(e)}"
        )


def _split_table_fqn(table_fqn):
    """Splits a fully qualified table name into its components."""
    try:
        pattern = r"^([^.]+)[\.:]([^.]+)\.([^.]+)"
        logger.debug(f"Splitting table FQN: {table_fqn}.")
        match = re.search(pattern, table_fqn)
        return match.group(1), match.group(2), match.group(3)
    except Exception as e:
        logger.error(f"Exception: {e}.")
        raise e


def _construct_bq_resource_string(table_fqn):
    """Constructs a BigQuery resource string for use in API calls."""
    try:
        project_id, dataset_id, table_id = _split_table_fqn(table_fqn)
        return f"//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"
    except Exception as e:
        logger.error(f"Exception: {e}.")
        raise e


def _get_table_scan_reference(table_fqn, project_id, location, scan_client):
    """Retrieves data scan references for a BigQuery table."""
    try:
        # logger.info(f"Getting table scan reference for table: {table_fqn}.")
        data_scans = scan_client.list_data_scans(
            parent=f"projects/{project_id}/locations/{location}"
        )
        bq_resource_string = _construct_bq_resource_string(table_fqn)
        # logger.info(f"Looking for scans with resource: {bq_resource_string}")
        scan_references = []
        for scan in data_scans:
            if scan.data.resource == bq_resource_string:
                scan_references.append(scan.name)
        # logger.info(f"Found scan references: {scan_references}")
        return scan_references
    except Exception as e:
        logger.error(f"Exception: {e}.")
        raise e


def _get_table_profile_quality(
    use_enabled, table_fqn, project_id, location, scan_client
):
    """Retrieves both profile and quality information for a BigQuery table."""
    try:
        if use_enabled:
            data_profile_results = []
            data_quality_results = []
            table_scan_references = _get_table_scan_reference(
                table_fqn, project_id, location, scan_client
            )

            for table_scan_reference in table_scan_references:
                if table_scan_reference:
                    scan_jobs = scan_client.list_data_scan_jobs(
                        ListDataScanJobsRequest(
                            parent=scan_client.get_data_scan(
                                GetDataScanRequest(name=table_scan_reference)
                            ).name
                        )
                    )

                    for job in scan_jobs:
                        job_result = scan_client.get_data_scan_job(
                            request=GetDataScanJobRequest(name=job.name, view="FULL")
                        )
                        if job_result.state == DataScanJob.State.SUCCEEDED:
                            if job_result.data_quality_result:
                                quality_result = job_result.data_quality_result
                                # logger.info(
                                #     f"Processing quality result: {quality_result}"
                                # )
                                formatted_quality = {"dimensions": [], "rules": []}

                                # Format dimensions
                                for dim in quality_result.dimensions:
                                    formatted_quality["dimensions"].append(
                                        {
                                            "dimension": {"name": dim.dimension.name},
                                            "score": float(dim.score),
                                            "passed": dim.passed,
                                        }
                                    )

                                # Format rules from quality_result.rules
                                for rule in quality_result.rules:
                                    rule_info = {
                                        "column": rule.rule.column,
                                        "dimension": rule.rule.dimension,
                                        "passed": rule.passed,
                                        "passRatio": float(rule.pass_ratio),
                                        "passedCount": int(rule.passed_count),
                                        "evaluatedCount": int(rule.evaluated_count),
                                        "failing_rows_query": rule.failing_rows_query,
                                        "rule": {
                                            "non_null_expectation": (
                                                bool(rule.rule.non_null_expectation)
                                                if hasattr(
                                                    rule.rule, "non_null_expectation"
                                                )
                                                else None
                                            ),
                                            "uniqueness_expectation": (
                                                bool(rule.rule.uniqueness_expectation)
                                                if hasattr(
                                                    rule.rule, "uniqueness_expectation"
                                                )
                                                else None
                                            ),
                                            "set_expectation": (
                                                {
                                                    "values": list(
                                                        rule.rule.set_expectation.values
                                                    ),
                                                }
                                                if hasattr(rule.rule, "set_expectation")
                                                else None
                                            ),
                                            "row_condition_expectation": (
                                                {
                                                    "sql_expression": rule.rule.row_condition_expectation.sql_expression
                                                }
                                                if hasattr(
                                                    rule.rule,
                                                    "row_condition_expectation",
                                                )
                                                else None
                                            ),
                                        },
                                    }
                                    formatted_quality["rules"].append(rule_info)

                                data_quality_results.append(formatted_quality)

                            if job_result.data_profile_result:
                                profile = job_result.data_profile_result
                                # logger.info(f"Processing profile result: {profile}")

                                formatted_profile = {
                                    "rowCount": int(profile.row_count),
                                    "fields": [],
                                }

                                # Process each field in the profile
                                if hasattr(profile, "profile") and hasattr(
                                    profile.profile, "fields"
                                ):
                                    for field in profile.profile.fields:
                                        field_info = {
                                            "name": field.name,
                                            "type": field.type_,
                                            "mode": field.mode,
                                            "nullCount": 0,
                                            "distinctCount": 0,
                                            "topNValues": [],
                                            "profile": {
                                                "minLength": 0,
                                                "maxLength": 0,
                                                "avgLength": 0.0,
                                            },
                                        }

                                        if hasattr(field, "profile"):
                                            profile_info = field.profile
                                            # Add distinct ratio
                                            field_info["distinctRatio"] = (
                                                profile_info.distinct_ratio
                                            )

                                            # Add top N values with their counts and ratios
                                            if hasattr(profile_info, "top_n_values"):
                                                for value in profile_info.top_n_values:
                                                    field_info["topNValues"].append(
                                                        {
                                                            "value": str(value.value),
                                                            "count": int(value.count),
                                                            "ratio": float(value.ratio),
                                                        }
                                                    )

                                            # Add string profile if available
                                            if hasattr(profile_info, "string_profile"):
                                                field_info["profile"].update(
                                                    {
                                                        "minLength": int(
                                                            profile_info.string_profile.min_length
                                                        ),
                                                        "maxLength": int(
                                                            profile_info.string_profile.max_length
                                                        ),
                                                        "avgLength": float(
                                                            profile_info.string_profile.average_length
                                                        ),
                                                    }
                                                )

                                            # Calculate null and distinct counts
                                            total_rows = profile.row_count
                                            field_info["nullCount"] = (
                                                int(
                                                    total_rows
                                                    * (1 - profile_info.non_null_ratio)
                                                )
                                                if hasattr(
                                                    profile_info, "non_null_ratio"
                                                )
                                                else 0
                                            )
                                            field_info["distinctCount"] = (
                                                int(
                                                    total_rows
                                                    * profile_info.distinct_ratio
                                                )
                                                if hasattr(
                                                    profile_info, "distinct_ratio"
                                                )
                                                else 0
                                            )

                                        formatted_profile["fields"].append(field_info)

                                data_profile_results.append(formatted_profile)

            # logger.info(f"Final profile results: {data_profile_results}")
            # logger.info(f"Final quality results: {data_quality_results}")

            return {
                "data_profile": data_profile_results,
                "data_quality": data_quality_results,
            }
        else:
            return {
                "data_profile": [],
                "data_quality": [],
            }
    except Exception as e:
        logger.error(f"Exception: {e}")
        raise e


@app.get("/api/data-products/{table_id}/lineage")
async def get_table_lineage(table_id: str, project_id: str, location: str):
    """Get lineage information for a BigQuery table"""
    try:
        catalog_client = dataplex_v1.CatalogServiceClient()
        try:
            # List all entries and find our table
            parent = f"projects/{project_id}/locations/{location}/entryGroups/@bigquery"
            request = dataplex_v1.ListEntriesRequest(parent=parent)
            entries = catalog_client.list_entries(request=request)
            table_entry = None

            # Find the specific table entry
            for entry in entries:
                if table_id in entry.name:
                    table_entry = entry
                    break

            if not table_entry:
                logger.warning(f"No matching entry found for table_id: {table_id}")
                return {"sources": [], "processes": []}

            # Get the table's fully qualified name for lineage lookup
            table_fqn = (
                table_entry.entry_source.resource.replace(
                    "//bigquery.googleapis.com/projects/", ""
                )
                .replace("/datasets/", ".")
                .replace("/tables/", ".")
            )

            try:
                lineage_client = datacatalog_lineage_v1.LineageClient()

                target = datacatalog_lineage_v1.EntityReference()
                target.fully_qualified_name = f"bigquery:{table_fqn}"

                request = datacatalog_lineage_v1.SearchLinksRequest(
                    parent=f"projects/{project_id}/locations/{location}",
                    target=target,
                )

                link_results = lineage_client.search_links(request=request)
                sources = []
                processes = []

                for link in link_results:
                    if link.target.fully_qualified_name == target.fully_qualified_name:
                        source_table = link.source.fully_qualified_name.replace(
                            "bigquery:", ""
                        )
                        sources.append(source_table)

                        # Get process information
                        process_request = (
                            datacatalog_lineage_v1.BatchSearchLinkProcessesRequest(
                                parent=f"projects/{project_id}/locations/{location}",
                                links=[link.name],
                            )
                        )
                        process_results = lineage_client.batch_search_link_processes(
                            request=process_request
                        )

                        for process in process_results:
                            process_details = lineage_client.get_process(
                                request=datacatalog_lineage_v1.GetProcessRequest(
                                    name=process.process
                                )
                            )

                            # Create process info with safer field access
                            process_info = {
                                "id": process_details.attributes.get(
                                    "bigquery_job_id", "unknown"
                                ),
                                "sql": process_details.display_name,
                            }

                            # Only add timestamps if they exist in the attributes
                            if "start_time" in process_details.attributes:
                                process_info["start_time"] = process_details.attributes[
                                    "start_time"
                                ]
                            if "end_time" in process_details.attributes:
                                process_info["end_time"] = process_details.attributes[
                                    "end_time"
                                ]

                            processes.append(process_info)

                return {"sources": sources, "processes": processes}

            except Exception as e:
                logger.error(f"Error getting lineage details: {str(e)}")
                return {"sources": [], "processes": []}

        except google_exceptions.NotFound as e:
            logger.warning(f"Entry not found: {str(e)}")
            return {"sources": [], "processes": []}

    except Exception as e:
        logger.error(f"Error getting table lineage: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error getting table lineage: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint that provides API information"""
    return {
        "message": "Data Roster API",
        "version": "1.0",
        "endpoints": {
            "data_products": "/api/data-products",
            "data_product_profile": "/api/data-products/{table_id}/profile",
            "data_product_lineage": "/api/data-products/{table_id}/lineage",
            "docs": "/docs",
            "openapi": "/openapi.json",
        },
    }


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_redirect():
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn

    # Get port from environment variable or default to 8080
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

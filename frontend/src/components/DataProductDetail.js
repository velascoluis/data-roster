import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/DataProductDetail.css';
import * as d3 from 'd3';
import { getCachedData, setCachedData } from '../utils/cache';

const getKindColor = (kind) => {
    const colors = {
        'application': '#2196F3',
        'consumer-aligned': '#4CAF50',
        'dataconsumer': '#FF9800',
        'source-aligned': '#9C27B0'
    };
    return colors[kind] || '#757575';
};

function Modal({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                {children}
            </div>
        </div>
    );
}

function QualityRuleDetails({ rule }) {
    const [showFailingQuery, setShowFailingQuery] = useState(false);
    const [showAllowedValues, setShowAllowedValues] = useState(false);

    const getRuleDescription = (rule) => {
        if (rule.rule.non_null_expectation) {
            return "Non-null values expected";
        } else if (rule.rule.uniqueness_expectation) {
            return "Unique values expected";
        } else if (rule.rule.set_expectation) {
            const values = rule.rule.set_expectation.values;
            if (values && values.length > 0) {
                return `Values must be in the allowed set (${values.length} values)`;
            }
            return "Values must be in the allowed set";
        } else if (rule.rule.row_condition_expectation) {
            return `Custom condition: ${rule.rule.row_condition_expectation.sql_expression}`;
        }
        return "Custom rule";
    };

    return (
        <div className="quality-rule">
            <div className="rule-header">
                <span className="rule-column">{rule.column || 'All Columns'}</span>
                <span className="rule-dimension">{rule.dimension || 'N/A'}</span>
            </div>
            <div className="rule-details">
                <p className="rule-description">{getRuleDescription(rule)}</p>
                <p>Pass Ratio: {(rule.passRatio * 100).toFixed(1)}%</p>
                <p>Passed: {rule.passedCount} / {rule.evaluatedCount}</p>
                {rule.failing_rows_query && (
                    <div className="failing-rows">
                        <button
                            className="view-failing-rows"
                            onClick={() => setShowFailingQuery(!showFailingQuery)}
                        >
                            {showFailingQuery ? 'Hide' : 'Show'} Failing Rows Query
                        </button>
                        {showFailingQuery && (
                            <div className="failing-rows-query">
                                <small>{rule.failing_rows_query}</small>
                            </div>
                        )}
                    </div>
                )}
                {rule.rule.set_expectation?.values && (
                    <div className="allowed-values">
                        <button
                            className="view-allowed-values"
                            onClick={() => setShowAllowedValues(!showAllowedValues)}
                        >
                            {showAllowedValues ? 'Hide' : 'Show'} Allowed Values
                        </button>
                        {showAllowedValues && (
                            <div className="values-list">
                                <ul>
                                    {rule.rule.set_expectation.values.map((value, idx) => (
                                        <li key={idx}>{value}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function LineageGraph({ tableName, sources = [], processes = [], dataProducts = [] }) {
    useEffect(() => {
        // Clear existing graph
        const graphElement = d3.select("#lineage-graph");
        if (!graphElement.empty()) {
            graphElement.selectAll("*").remove();
        }

        const width = 1000; // Increased width
        const height = 800; // Increased height
        const nodeRadius = 8;
        const boxWidth = 200; // Slightly wider boxes
        const boxHeight = 100; // Slightly taller boxes
        const verticalSpacing = height / 3; // Control vertical spacing between levels

        // Create SVG container
        const svg = d3.select("#lineage-graph")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("class", "lineage-svg");

        // Create the main group with zoom behavior
        const g = svg.append("g");

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Helper function to get data product info
        const getDataProductForTable = (tableName) => {
            return dataProducts.find(dp =>
                dp.components.some(comp =>
                    comp.source.resource.split('/').pop() === tableName
                )
            );
        };

        // Calculate positions for nodes
        const targetX = width / 2;
        const targetY = height - verticalSpacing; // Position target at bottom

        // Calculate source node positions
        const sourceSpacing = width / (sources.length + 1);

        // Create nodes array with target and source nodes
        const nodes = [
            {
                id: tableName,
                type: 'target',
                label: tableName.split('.').pop(),
                x: targetX,
                y: targetY,
                dataProduct: getDataProductForTable(tableName)
            },
            ...sources.map((source, index) => ({
                id: source,
                type: 'source',
                label: source.split('.').pop(),
                x: sourceSpacing * (index + 1),
                y: verticalSpacing, // Position sources at top
                dataProduct: getDataProductForTable(source.split('.').pop())
            }))
        ];

        // Group nodes by data product
        const nodesByDataProduct = {};
        nodes.forEach(node => {
            if (node.dataProduct) {
                const dpId = node.dataProduct.id;
                if (!nodesByDataProduct[dpId]) {
                    nodesByDataProduct[dpId] = [];
                }
                nodesByDataProduct[dpId].push(node);
            }
        });

        // Create data product containers
        Object.entries(nodesByDataProduct).forEach(([dpId, dpNodes]) => {
            // Calculate container size based on number of nodes
            const containerWidth = Math.max(boxWidth, dpNodes.length * boxWidth * 0.8);
            const containerHeight = boxHeight;

            // Calculate container position based on average position of its nodes
            const avgX = d3.mean(dpNodes, d => d.x);
            const avgY = d3.mean(dpNodes, d => d.y);

            const productGroup = g.append("g")
                .attr("class", "data-product")
                .attr("transform", `translate(${avgX - containerWidth / 2},${avgY - containerHeight / 2})`);

            // Add container rectangle
            productGroup.append("rect")
                .attr("width", containerWidth)
                .attr("height", containerHeight)
                .attr("rx", 8)
                .attr("ry", 8)
                .attr("fill", "#f8f9fa")
                .attr("stroke", "#e9ecef")
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.95);

            // Add data product label
            productGroup.append("text")
                .attr("x", containerWidth / 2)
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("class", "data-product-label")
                .style("font-size", "13px")
                .style("font-weight", "500")
                .style("fill", "#2196F3")
                .text(dpNodes[0].dataProduct.name);

            // Add kind badge
            productGroup.append("text")
                .attr("x", containerWidth / 2)
                .attr("y", containerHeight + 20)
                .attr("text-anchor", "middle")
                .attr("class", "data-product-kind")
                .style("font-size", "11px")
                .style("fill", "#666")
                .text(dpNodes[0].dataProduct.kind);
        });

        // Draw curved links
        const diagonal = d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y);

        // Create links array
        const links = sources.map(source => ({
            source: nodes.find(n => n.id === source),
            target: nodes.find(n => n.id === tableName)
        }));

        // Draw links
        g.selectAll(".link")
            .data(links)
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", diagonal)
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.6);

        // Add drop shadow filter
        const defs = svg.append("defs");
        const filter = defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "130%");

        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 2)
            .attr("result", "blur");

        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 1)
            .attr("result", "offsetBlur");

        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");

        // Create node groups
        const node = g.selectAll(".node")
            .data(nodes)
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`);

        // Add node circles
        node.append("circle")
            .attr("r", nodeRadius)
            .attr("fill", d => d.type === 'target' ? "#4CAF50" : "#2196F3")
            .style("filter", "url(#drop-shadow)")
            .style("cursor", "pointer")
            .on("mouseover", function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", nodeRadius + 2);
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", nodeRadius);
            });

        // Add node labels
        node.append("text")
            .attr("dx", d => d.type === 'target' ? 15 : -15)
            .attr("dy", 4)
            .attr("text-anchor", d => d.type === 'target' ? "start" : "end")
            .attr("class", "node-label")
            .style("font-size", "12px")
            .style("font-family", "'Roboto Mono', monospace")
            .style("fill", "#333")
            .text(d => d.label);

    }, [tableName, sources, processes, dataProducts]);

    return (
        <div id="lineage-graph" style={{
            width: '100%',
            height: '800px', // Increased height
            overflow: 'hidden',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            position: 'relative'
        }} />
    );
}

function DataProductDetail({ dataProducts }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState({});
    const [lineageData, setLineageData] = useState({});
    const [loadingStates, setLoadingStates] = useState({});
    const [errors, setErrors] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [modalContent, setModalContent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const product = dataProducts.find(p => p.id === id);

    useEffect(() => {
        const fetchData = async (component) => {
            const isBigQueryTable =
                component.source.system === "BIGQUERY" &&
                component.type.toLowerCase().includes('table');

            if (isBigQueryTable) {
                setLoadingStates(prev => ({
                    ...prev,
                    [component.id]: true
                }));

                try {
                    const config = JSON.parse(localStorage.getItem('dataplexConfig') || '{}');

                    if (!config.project_id || !config.location) {
                        throw new Error('Missing configuration');
                    }

                    // Check cache for profile and lineage data
                    let profileData = getCachedData(`profileDataCache_${component.id}`);
                    let lineageData = getCachedData(`lineageDataCache_${component.id}`);

                    // Fetch any uncached data
                    if (!profileData || !lineageData) {
                        const [profileResponse, lineageResponse] = await Promise.all([
                            !profileData && fetch(`http://localhost:8000/api/data-products/${component.id}/profile?project_id=${config.project_id}&location=${config.location}`),
                            !lineageData && fetch(`http://localhost:8000/api/data-products/${component.id}/lineage?project_id=${config.project_id}&location=${config.location}`)
                        ].filter(Boolean));

                        if ((profileResponse && !profileResponse.ok) || (lineageResponse && !lineageResponse.ok)) {
                            throw new Error('Failed to fetch data');
                        }

                        // Get fresh profile data if needed
                        if (profileResponse) {
                            profileData = await profileResponse.json();
                            setCachedData(`profileDataCache_${component.id}`, profileData);
                        }

                        // Get fresh lineage data if needed
                        if (lineageResponse) {
                            lineageData = await lineageResponse.json();
                            console.log('Raw lineage response:', lineageData);

                            // Set the lineage data directly without wrapping
                            setLineageData(prev => ({
                                ...prev,
                                [component.id]: lineageData  // Remove the extra lineage wrapper
                            }));

                            setCachedData(`lineageDataCache_${component.id}`, lineageData);
                        }
                    }

                    setProfileData(prev => ({
                        ...prev,
                        [component.id]: profileData
                    }));

                    setLineageData(prev => ({
                        ...prev,
                        [component.id]: lineageData
                    }));

                    // Add debug log after setting lineage data
                    if (lineageData) {
                        console.log('Lineage data received for component:', component.id, lineageData);
                    }

                } catch (error) {
                    console.error('Error fetching data:', error);
                    setErrors(prev => ({
                        ...prev,
                        [component.id]: error.message
                    }));
                } finally {
                    setLoadingStates(prev => ({
                        ...prev,
                        [component.id]: false
                    }));
                }
            }
        };

        if (product) {
            product.components.forEach(component => {
                fetchData(component);
            });
        }
    }, [product]);

    const toggleSection = (componentId, section) => {
        setExpandedSections(prev => ({
            ...prev,
            [`${componentId}-${section}`]: !prev[`${componentId}-${section}`]
        }));
    };

    const showTopValues = (fieldName, topValues) => {
        setModalContent(
            <div className="top-values-modal">
                <h3>{fieldName} - Top Values</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Value</th>
                            <th>Count</th>
                            <th>Ratio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topValues.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.value}</td>
                                <td>{item.count}</td>
                                <td>{(item.ratio * 100).toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        setIsModalOpen(true);
    };

    const renderProfileData = (component) => {
        // Add debug log
        console.log('Profile data for component:', profileData[component.id]);

        if (loadingStates[component.id]) {
            return <div className="profile-loading">Loading profile data...</div>;
        }

        if (errors[component.id]) {
            return <div className="profile-error">{errors[component.id]}</div>;
        }

        if (!profileData || !profileData[component.id]) {
            return null;
        }

        const { data_profile, data_quality, schema } = profileData[component.id];
        const firstProfile = data_profile?.[0];
        const firstQuality = data_quality?.[0];

        return (
            <>
                {schema && (
                    <div className="section-header" onClick={() => toggleSection(component.id, 'schema')}>
                        <h4>Schema</h4>
                        <span className="expand-icon">
                            {expandedSections[`${component.id}-schema`] ? '▼' : '▶'}
                        </span>
                    </div>
                )}

                {expandedSections[`${component.id}-schema`] && schema && (
                    <div className="schema-section">
                        {schema.description && (
                            <div className="table-description">
                                <p><strong>Description:</strong> {schema.description}</p>
                            </div>
                        )}
                        <div className="schema-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Column</th>
                                        <th>Type</th>
                                        <th>Mode</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schema.fields.map((field, idx) => (
                                        <tr key={idx}>
                                            <td>{field.name}</td>
                                            <td>{field.type}</td>
                                            <td>{field.mode}</td>
                                            <td>{field.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="section-header" onClick={() => toggleSection(component.id, 'profile')}>
                    <h4>Data Profile</h4>
                    <span className="expand-icon">
                        {expandedSections[`${component.id}-profile`] ? '▼' : '▶'}
                    </span>
                </div>

                {expandedSections[`${component.id}-profile`] && firstProfile && (
                    <div className="profile-section">
                        <p className="total-rows">Total rows: {firstProfile.rowCount || 'N/A'}</p>
                        <div className="profile-grid">
                            {firstProfile.fields?.map((field, idx) => (
                                <div key={idx} className="profile-field">
                                    <h5>{field.name}</h5>
                                    <div className="profile-stats">
                                        <p>
                                            <span>Type:</span>
                                            <span>{field.type}</span>
                                        </p>
                                        <p>
                                            <span>Mode:</span>
                                            <span>{field.mode}</span>
                                        </p>
                                        <p>
                                            <span>Null Count:</span>
                                            <span>{field.nullCount}</span>
                                        </p>
                                        <p>
                                            <span>Distinct Count:</span>
                                            <span>{field.distinctCount}</span>
                                        </p>
                                        {field.profile && (
                                            <>
                                                <p>
                                                    <span>Min Length:</span>
                                                    <span>{field.profile.minLength}</span>
                                                </p>
                                                <p>
                                                    <span>Max Length:</span>
                                                    <span>{field.profile.maxLength}</span>
                                                </p>
                                                <p>
                                                    <span>Avg Length:</span>
                                                    <span>{field.profile.avgLength.toFixed(1)}</span>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    {field.topNValues?.length > 0 && (
                                        <div className="value-frequencies">
                                            <h6>Top Values</h6>
                                            <button
                                                className="view-top-values"
                                                onClick={() => showTopValues(field.name, field.topNValues)}
                                            >
                                                View all values
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {firstQuality && (
                    <>
                        <div className="section-header" onClick={() => toggleSection(component.id, 'quality')}>
                            <h4>Data Quality</h4>
                            <span className="expand-icon">
                                {expandedSections[`${component.id}-quality`] ? '▼' : '▶'}
                            </span>
                        </div>

                        {expandedSections[`${component.id}-quality`] && (
                            <div className="quality-section">
                                {firstQuality.dimensions?.length > 0 && (
                                    <div className="quality-dimensions">
                                        <h5>Quality Dimensions</h5>
                                        {firstQuality.dimensions.map((dim, idx) => (
                                            <div key={idx} className={`quality-dimension ${dim.passed ? 'passed' : 'failed'}`}>
                                                <span className="dimension-name">{dim.dimension?.name || 'Unknown'}</span>
                                                <span className="dimension-score">Score: {(dim.score * 100).toFixed(1)}%</span>
                                                <span className="dimension-status">{dim.passed ? '✓ PASSED' : '✗ FAILED'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {firstQuality.rules?.length > 0 && (
                                    <div className="quality-rules">
                                        <h5>Quality Rules</h5>
                                        {firstQuality.rules.map((rule, idx) => (
                                            <QualityRuleDetails key={idx} rule={rule} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                <div className="section-header" onClick={() => toggleSection(component.id, 'lineage')}>
                    <h4>Data Lineage</h4>
                    <span className="expand-icon">
                        {expandedSections[`${component.id}-lineage`] ? '▼' : '▶'}
                    </span>
                </div>

                {expandedSections[`${component.id}-lineage`] && (
                    <div className="lineage-section">
                        {lineageData[component.id] ? (
                            <>
                                {/* Add debug output */}

                                <LineageGraph
                                    tableName={component.source.resource.split('/').pop()}
                                    sources={lineageData[component.id]?.sources || []}
                                    processes={lineageData[component.id]?.processes || []}
                                    dataProducts={dataProducts}
                                />
                            </>
                        ) : (
                            <div className="loading-message">Loading lineage data...</div>
                        )}
                    </div>
                )}
            </>
        );
    };

    if (!product) {
        return (
            <div className="detail-page">
                <div className="detail-header">
                    <button className="back-button" onClick={() => navigate('/')}>
                        <span className="material-icons-round">arrow_back</span>
                        Back to List
                    </button>
                </div>
                <div className="not-found">
                    <p>Data Product not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="back-button" onClick={() => navigate('/')}>
                    <span className="material-icons-round">arrow_back</span>
                    Back to List
                </button>
            </div>
            <div className="detail-content">
                <div className="detail-title">
                    <h1>{product.name}</h1>
                    <div className="detail-metadata">
                        <span className="kind-badge" style={{
                            backgroundColor: `${getKindColor(product.kind)}15`,
                            color: getKindColor(product.kind)
                        }}>
                            {product.kind}
                        </span>
                        <span className="team-badge">{product.team}</span>
                    </div>
                </div>

                <section className="detail-section">
                    <h2>Components</h2>
                    <div className="components-grid">
                        {product.components.map((component) => (
                            <div key={component.id} className="component-card">
                                <div className="component-header">
                                    <h3>{component.name}</h3>
                                    <span className="component-type">{component.type}</span>
                                </div>
                                <div className="component-details">
                                    <p className="detail-item">
                                        <span className="detail-label">Source:</span>
                                        <span className="detail-value">{component.source.system}</span>
                                    </p>
                                    <p className="detail-item resource">
                                        <span className="detail-label">Resource:</span>
                                        <span className="detail-value">
                                            {component.source.resource.split('//').pop()}
                                        </span>
                                    </p>
                                    {component.source.system === "BIGQUERY" &&
                                        component.type.toLowerCase().includes('table') &&
                                        renderProfileData(component)}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            >
                {modalContent}
            </Modal>
        </div>
    );
}

export default DataProductDetail; 
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import yaml from 'js-yaml';

function DataContractEditor({ dataProducts, onSave }) {
    const { productId, contractId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        const product = dataProducts.find(p => p.id === productId);
        if (!product) {
            setError('Data product not found');
            return;
        }

        if (!contractId) {
            // New contract template
            setContent(`dataContractSpecification: 1.1.0
id: ${product.id}_contract_${Date.now()}
info:
  title: ${product.name} Contract
  version: 1.0.0
  description: Data contract for ${product.name}
  status: draft
  owner: ${product.team}
  contact:
    name: Team Contact
    email: contact@example.com
terms:
  usage: Max. 10x queries per day
  limitations: Not suitable for real-time use cases
  billing: Define billing terms
  noticePeriod: P3M
models:
  ${product.id}:
    description: ${product.name} data model
    title: ${product.name}
    fields:
      # Add fields based on your data product schema
examples:
  - type: csv
    model: ${product.id}
    description: Sample data
    data: |
      # Add sample data here
tags:
  - ${product.kind}`);
        } else {
            // Load existing contract
            const contract = product.contracts?.find(c => c.id === contractId);
            if (contract) {
                setContent(yaml.dump(contract));
            } else {
                setError('Contract not found');
            }
        }
    }, [productId, contractId, dataProducts]);

    const handleSave = async () => {
        try {
            const parsedYaml = yaml.load(content);
            const success = await onSave(parsedYaml, productId);

            if (success) {
                navigate('/contracts');
            } else {
                setError('Failed to save contract');
            }
        } catch (err) {
            setError('Invalid YAML format: ' + err.message);
        }
    };

    if (error) {
        return (
            <div className="contract-editor">
                <div className="error-message">{error}</div>
                <button className="back-btn" onClick={() => navigate('/contracts')}>
                    Back to Contracts
                </button>
            </div>
        );
    }

    return (
        <div className="contract-editor">
            <div className="editor-header">
                <h2>{contractId ? 'Edit Contract' : 'Create New Contract'}</h2>
                <div className="editor-actions">
                    <button className="cancel-btn" onClick={() => navigate('/contracts')}>
                        Cancel
                    </button>
                    <button className="save-btn" onClick={handleSave}>
                        Save Contract
                    </button>
                </div>
            </div>
            <div className="editor-container">
                <MonacoEditor
                    height="70vh"
                    language="yaml"
                    theme="vs-light"
                    value={content}
                    onChange={setContent}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        rulers: [80],
                        wordWrap: 'on',
                    }}
                />
            </div>
        </div>
    );
}

export default DataContractEditor; 
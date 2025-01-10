import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/DataContracts.css';

function DataContractsList({ dataProducts = [] }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = dataProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.team.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="contracts-list">
            <div className="list-header">
                <h2>Data Contracts</h2>
                <div className="list-controls">
                    <input
                        type="text"
                        placeholder="Search data products..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="products-contracts">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="product-contracts-section">
                        <div className="product-header">
                            <div className="product-info">
                                <h3>{product.name}</h3>
                                <div className="product-metadata">
                                    <span className={`kind-badge ${product.kind}`}>
                                        {product.kind}
                                    </span>
                                    <span className="team-badge">{product.team}</span>
                                </div>
                            </div>
                            <button
                                className="create-contract-btn"
                                onClick={() => navigate(`/contracts/new/${product.id}`)}
                            >
                                Create Contract
                            </button>
                        </div>

                        {(!product.contracts || product.contracts.length === 0) ? (
                            <p className="no-contracts">No contracts defined for this data product.</p>
                        ) : (
                            <div className="contracts-grid">
                                {product.contracts.map((contract) => (
                                    <div key={contract.id} className="contract-card">
                                        <div className="card-header">
                                            <h4>{contract.info.title}</h4>
                                            <span className={`status-badge ${contract.info.status}`}>
                                                {contract.info.status}
                                            </span>
                                        </div>
                                        <div className="card-content">
                                            <p className="description">{contract.info.description}</p>
                                            <div className="metadata">
                                                <div className="metadata-item">
                                                    <span className="label">Version:</span>
                                                    <span className="value">{contract.info.version}</span>
                                                </div>
                                                <div className="metadata-item">
                                                    <span className="label">Owner:</span>
                                                    <span className="value">{contract.info.owner}</span>
                                                </div>
                                            </div>
                                            <div className="card-actions">
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => navigate(`/contracts/edit/${product.id}/${contract.id}`)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => {
                                                        if (window.confirm('Are you sure you want to delete this contract?')) {
                                                            // Handle delete
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DataContractsList; 
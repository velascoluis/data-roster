import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Governance.css';

function GovernanceList({ dataProducts }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = dataProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.team.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="governance-list">
            <div className="list-header">
                <h2>Data Access Governance</h2>
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
            <div className="products-grid">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="product-card">
                        <div className="product-header">
                            <h3>{product.name}</h3>
                            <div className="product-metadata">
                                <span className={`kind-badge ${product.kind}`}>
                                    {product.kind}
                                </span>
                                <span className="team-badge">{product.team}</span>
                            </div>
                        </div>
                        <div className="product-content">
                            <div className="access-info">
                                <div className="contract-status">
                                    <span className="label">Data Contract:</span>
                                    <span className={`status ${product.contracts?.length ? 'available' : 'none'}`}>
                                        {product.contracts?.length ? 'Available' : 'No contract'}
                                    </span>
                                </div>
                            </div>
                            <button
                                className="request-access-btn"
                                onClick={() => navigate(`/governance/request/${product.id}`)}
                            >
                                Request Access
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GovernanceList; 
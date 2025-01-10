import React from 'react';
import { useNavigate } from 'react-router-dom';

function DataProductCard({ product }) {
    const navigate = useNavigate();

    const getKindColor = (kind) => {
        const colors = {
            'application': '#2196F3',
            'consumer-aligned': '#4CAF50',
            'dataconsumer': '#FF9800',
            'source-aligned': '#9C27B0'
        };
        return colors[kind] || '#757575';
    };

    return (
        <div
            className="data-product-card"
            onClick={() => navigate(`/product/${product.id}`)}
            role="button"
            tabIndex={0}
        >
            <div className="card-header">
                <div className="header-main">
                    <h3>{product.name}</h3>
                    <span
                        className="kind-badge"
                        style={{
                            backgroundColor: `${getKindColor(product.kind)}15`,
                            color: getKindColor(product.kind)
                        }}
                    >
                        {product.kind}
                    </span>
                </div>
                <span className="team-badge">{product.team}</span>
            </div>
            <div className="card-content">
                <div className="components-section">
                    <h4>Components</h4>
                    <ul className="components-list">
                        {product.components.map(component => (
                            <li key={component.id} className="component-item">
                                <span className="component-name">{component.name}</span>
                                <span className="component-type">{component.type}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default DataProductCard; 
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/Governance.css';

function AccessRequest({ dataProducts }) {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        purpose: '',
        duration: '3months',
        acceptedContract: false
    });

    const product = dataProducts.find(p => p.id === productId);
    if (!product) return <div>Product not found</div>;

    const workflowSteps = [
        { id: 1, name: 'Request Initiation', status: 'current' },
        { id: 2, name: 'Team Manager Review', status: 'pending' },
        { id: 3, name: 'Data Owner Review', status: 'pending' },
        { id: 4, name: 'DPO Assessment', status: 'pending' },
        { id: 5, name: 'Access Provisioning', status: 'pending' }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would typically submit the request
        navigate(`/governance/request/${productId}/status`);
    };

    return (
        <div className="access-request">
            <div className="request-header">
                <h2>Request Access to {product.name}</h2>
                <div className="workflow-steps">
                    {workflowSteps.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div className={`workflow-step ${step.status}`}>
                                <div className="step-number">{step.id}</div>
                                <div className="step-name">{step.name}</div>
                            </div>
                            {index < workflowSteps.length - 1 && (
                                <div className="step-connector" />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className="request-form">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Purpose of Access:</label>
                        <textarea
                            required
                            value={formData.purpose}
                            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            placeholder="Describe why you need access to this data product..."
                        />
                    </div>
                    <div className="form-group">
                        <label>Access Duration:</label>
                        <select
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        >
                            <option value="3months">3 Months</option>
                            <option value="6months">6 Months</option>
                            <option value="1year">1 Year</option>
                            <option value="permanent">Permanent</option>
                        </select>
                    </div>
                    {product.contracts?.length > 0 && (
                        <div className="form-group contract-acceptance">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.acceptedContract}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        acceptedContract: e.target.checked
                                    })}
                                    required
                                />
                                I accept the terms of the data contract
                            </label>
                            <button
                                type="button"
                                className="view-contract-btn"
                                onClick={() => navigate(`/contracts/view/${productId}`)}
                            >
                                View Contract
                            </button>
                        </div>
                    )}
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => navigate('/governance')}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-btn">
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AccessRequest; 
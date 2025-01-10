import React, { useState } from 'react';

function ConfigModal({ isOpen, onClose, onSave, currentConfig }) {
    const [config, setConfig] = useState(currentConfig || {
        project_id: '',
        location: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(config);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="config-modal-overlay">
            <div className="config-modal">
                <h2>Dataplex Configuration</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="project_id">Project ID</label>
                        <input
                            type="text"
                            id="project_id"
                            value={config.project_id}
                            onChange={(e) => setConfig({ ...config, project_id: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="location">Location</label>
                        <input
                            type="text"
                            id="location"
                            value={config.location}
                            onChange={(e) => setConfig({ ...config, location: e.target.value })}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit">Save Configuration</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ConfigModal; 
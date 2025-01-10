import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';

function Header({ onConfigClick, onRefresh }) {
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [currentLogo, setCurrentLogo] = useState(logo);
    const fileInputRef = useRef(null);
    const location = useLocation();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleLogoUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newLogo = e.target.result;
                setCurrentLogo(newLogo);
                // Save to localStorage for persistence
                localStorage.setItem('companyLogo', newLogo);
            };
            reader.readAsDataURL(file);
        }
    };

    // Load saved logo on component mount
    React.useEffect(() => {
        const savedLogo = localStorage.getItem('companyLogo');
        if (savedLogo) {
            setCurrentLogo(savedLogo);
        }
    }, []);

    const handleRefreshClick = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="logo-container">
                    <img src={currentLogo} alt="DataRoster Logo" className="logo" />
                    <h1>DataRoster</h1>
                    <button
                        className="upload-logo-btn"
                        onClick={() => fileInputRef.current.click()}
                    >
                        Upload logo
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                </div>
                <nav className="main-nav">
                    <div className="nav-links">
                        <Link
                            to="/"
                            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                        >
                            Data Products
                        </Link>
                        <Link
                            to="/contracts"
                            className={`nav-link ${location.pathname.startsWith('/contracts') ? 'active' : ''}`}
                        >
                            Data Contracts
                        </Link>
                        <Link
                            to="/governance"
                            className={`nav-link ${location.pathname.startsWith('/governance') ? 'active' : ''}`}
                        >
                            Governance
                        </Link>
                    </div>
                    <button
                        className="how-it-works-btn"
                        onClick={() => setShowHowItWorks(true)}
                    >
                        How it works
                    </button>
                    <button
                        className={`refresh-btn ${isRefreshing ? 'loading' : ''}`}
                        onClick={handleRefreshClick}
                        title="Refresh data"
                        disabled={isRefreshing}
                    >
                        <span className="material-icons-round">refresh</span>
                    </button>
                    <button className="config-btn" onClick={onConfigClick} title="Settings">
                        <span className="material-icons-round">settings</span>
                    </button>
                </nav>
            </div>

            {showHowItWorks && (
                <div className="how-it-works-modal">
                    <div className="modal-content">
                        <h3>How DataRoster Works</h3>
                        <p>To use DataRoster effectively, you need to tag your data assets with the following labels:</p>
                        <ul>
                            <li><strong>dataproduct-name:</strong> The name of your data product</li>
                            <li><strong>dataproduct-kind:</strong> The type/kind of your data product</li>
                            <li><strong>dataproduct-team:</strong> The team responsible for the data product</li>
                        </ul>
                        <button
                            className="close-modal-btn"
                            onClick={() => setShowHowItWorks(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header; 
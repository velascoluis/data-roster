import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import DataProductList from './components/DataProductList';
import DataProductDetail from './components/DataProductDetail';
import Header from './components/Header';
import ConfigModal from './components/ConfigModal';
import DataContractsList from './components/DataContractsList';
import DataContractEditor from './components/DataContractEditor';
import GovernanceList from './components/GovernanceList';
import AccessRequest from './components/AccessRequest';
import { clearCacheByPrefix } from './utils/cache';

const CACHE_KEY = 'dataProductsCache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

function App() {
    const [dataProducts, setDataProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [config, setConfig] = useState(() => {
        const savedConfig = localStorage.getItem('dataplexConfig');
        return savedConfig ? JSON.parse(savedConfig) : null;
    });
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(!config);

    const loadInitialData = () => {
        const savedDataProducts = localStorage.getItem('dataProducts');
        if (savedDataProducts) {
            setDataProducts(JSON.parse(savedDataProducts));
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const fetchDataProducts = async (config, forceRefresh = false) => {
        try {
            setLoading(true);
            setError(null);

            // Check cache if not forcing refresh
            if (!forceRefresh) {
                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    const { timestamp, data } = JSON.parse(cachedData);
                    const isExpired = Date.now() - timestamp > CACHE_DURATION;

                    if (!isExpired) {
                        console.log('Using cached data');
                        setDataProducts(data);
                        setLoading(false);
                        return;
                    }
                }
            }

            const response = await fetch(
                `http://localhost:8000/api/data-products?project_id=${config.project_id}&location=${config.location}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch data products');
            }

            const data = await response.json();
            const products = data.data_products || [];

            const existingProducts = JSON.parse(localStorage.getItem('dataProducts') || '[]');
            const mergedProducts = products.map(newProduct => {
                const existingProduct = existingProducts.find(p => p.id === newProduct.id);
                return {
                    ...newProduct,
                    contracts: existingProduct?.contracts || []
                };
            });

            // Update cache with new data and timestamp
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: mergedProducts
            }));

            setDataProducts(mergedProducts);
            localStorage.setItem('dataProducts', JSON.stringify(mergedProducts));
        } catch (error) {
            console.error('Error fetching data products:', error);
            setError(error.message);
            setDataProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (config) {
            fetchDataProducts(config);
        }
    }, [config]);

    const handleConfigSave = (newConfig) => {
        setConfig(newConfig);
        localStorage.setItem('dataplexConfig', JSON.stringify(newConfig));
    };

    const handleRefresh = async () => {
        try {
            if (!config) {
                setError("Please configure your Dataplex settings first");
                setIsConfigModalOpen(true);
                return;
            }

            // Clear all caches
            clearCacheByPrefix('dataProductsCache');
            clearCacheByPrefix('profileDataCache');
            clearCacheByPrefix('lineageDataCache');

            await fetchDataProducts(config, true);
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };

    const handleContractSave = async (contract, productId) => {
        try {
            const updatedDataProducts = JSON.parse(JSON.stringify(dataProducts));
            const product = updatedDataProducts.find(p => p.id === productId);

            if (!product) {
                throw new Error('Product not found');
            }

            if (!product.contracts) {
                product.contracts = [];
            }

            const contractIndex = product.contracts.findIndex(c => c.id === contract.id);
            if (contractIndex >= 0) {
                product.contracts[contractIndex] = contract;
            } else {
                product.contracts.push(contract);
            }

            setDataProducts(updatedDataProducts);
            localStorage.setItem('dataProducts', JSON.stringify(updatedDataProducts));

            return true;
        } catch (error) {
            console.error('Error saving contract:', error);
            return false;
        }
    };

    return (
        <BrowserRouter>
            <div className="App">
                <Header
                    onConfigClick={() => setIsConfigModalOpen(true)}
                    onRefresh={handleRefresh}
                />
                <main className="App-main">
                    {loading ? (
                        <div className="loading">Loading data products...</div>
                    ) : error ? (
                        <div className="error-message">
                            <p>Error: {error}</p>
                            <button onClick={() => fetchDataProducts(config)}>
                                Retry
                            </button>
                        </div>
                    ) : (
                        <Routes>
                            <Route
                                path="/"
                                element={<DataProductList dataProducts={dataProducts} />}
                            />
                            <Route
                                path="/product/:id"
                                element={<DataProductDetail dataProducts={dataProducts} />}
                            />
                            <Route
                                path="/contracts"
                                element={<DataContractsList dataProducts={dataProducts} />}
                            />
                            <Route
                                path="/contracts/new/:productId"
                                element={<DataContractEditor
                                    dataProducts={dataProducts}
                                    onSave={handleContractSave}
                                />}
                            />
                            <Route
                                path="/contracts/edit/:productId/:contractId"
                                element={<DataContractEditor
                                    dataProducts={dataProducts}
                                    onSave={handleContractSave}
                                />}
                            />
                            <Route
                                path="/governance"
                                element={<GovernanceList dataProducts={dataProducts} />}
                            />
                            <Route
                                path="/governance/request/:productId"
                                element={<AccessRequest dataProducts={dataProducts} />}
                            />
                        </Routes>
                    )}
                </main>
                <ConfigModal
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    onSave={handleConfigSave}
                    currentConfig={config}
                />
            </div>
        </BrowserRouter>
    );
}

export default App;

import React, { useState, useMemo } from 'react';
import DataProductCard from './DataProductCard';

function DataProductList({ dataProducts = [], isLoading = false }) {
    const [selectedKind, setSelectedKind] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');

    // Get unique kinds and teams for filters from currently available data
    const kinds = useMemo(() => {
        const uniqueKinds = new Set(dataProducts.map(product => product.kind));
        return Array.from(uniqueKinds).sort();
    }, [dataProducts]);

    const teams = useMemo(() => {
        const uniqueTeams = new Set(dataProducts.map(product => product.team));
        return Array.from(uniqueTeams).sort();
    }, [dataProducts]);

    // Filter data products based on selected filters
    const filteredProducts = useMemo(() => {
        return dataProducts.filter(product => {
            const kindMatch = !selectedKind || product.kind === selectedKind;
            const teamMatch = !selectedTeam || product.team === selectedTeam;
            return kindMatch && teamMatch;
        });
    }, [dataProducts, selectedKind, selectedTeam]);

    return (
        <div className="data-product-list">
            <div className="list-header">
                <h2>Data Products {isLoading && <span className="loading-indicator">(Loading...)</span>}</h2>
                <div className="list-controls">
                    <select
                        className="filter-select"
                        value={selectedKind}
                        onChange={(e) => setSelectedKind(e.target.value)}
                    >
                        <option value="">All Kinds</option>
                        {kinds.map(kind => (
                            <option key={kind} value={kind}>
                                {kind}
                            </option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                    >
                        <option value="">All Teams</option>
                        {teams.map(team => (
                            <option key={team} value={team}>
                                {team}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="products-grid">
                {filteredProducts.map(product => (
                    <DataProductCard key={product.id} product={product} />
                ))}
                {isLoading && filteredProducts.length === 0 && (
                    <div className="loading-message">
                        <p>Loading data products...</p>
                    </div>
                )}
                {!isLoading && filteredProducts.length === 0 && (
                    <div className="no-products">
                        <p>No data products found</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DataProductList; 
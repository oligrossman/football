/**
 * Football League Dashboard
 * 
 * Interactive dashboard showing cumulative points progression with:
 * - Plotly.js chart with hover tooltips and click-to-highlight
 * - Gameweek fixture table that updates on chart interaction
 */

// Global state
let leagueData = null;
let selectedTeam = null;
let selectedGameweek = null;
let teamColors = {};

// Color palette for teams (distinct, vibrant colors)
const COLOR_PALETTE = [
    '#00d4ff', '#00ff88', '#ffaa00', '#ff6b6b',
    '#9b59b6', '#3498db', '#e74c3c', '#f39c12',
    '#1abc9c', '#e67e22', '#34495e', '#16a085',
    '#d35400', '#c0392b', '#8e44ad', '#2980b9'
];

/**
 * Initialize the dashboard
 */
async function init() {
    try {
        // Load league data
        const response = await fetch('data/results.json');
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.statusText}`);
        }
        
        leagueData = await response.json();
        
        // Set up team colors
        assignTeamColors();
        
        // Update header
        updateHeader();
        
        // Build and render chart
        renderChart();
        
        // Initialize table with latest gameweek
        const latestWeek = leagueData.gameweeks.length > 0 
            ? leagueData.gameweeks[leagueData.gameweeks.length - 1].week 
            : null;
        updateTable(latestWeek);
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.getElementById('points-chart').innerHTML = 
            '<div style="text-align: center; padding: 40px; color: #ff4444;">' +
            'Error loading data. Please check that data/results.json exists and is valid.' +
            '</div>';
    }
}

/**
 * Assign colors to teams from the palette
 */
function assignTeamColors() {
    if (!leagueData || !leagueData.teams) return;
    
    leagueData.teams.forEach((team, index) => {
        teamColors[team] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    });
}

/**
 * Update header with league information
 */
function updateHeader() {
    document.getElementById('league-name').textContent = leagueData.league_name || 'League Dashboard';
    document.getElementById('venue').textContent = leagueData.venue || '';
    document.getElementById('last-updated').textContent = leagueData.last_updated || '';
}

/**
 * Calculate cumulative points for each team across gameweeks
 */
function calculateCumulativePoints() {
    const pointsByTeam = {};
    const gameweekPoints = [];
    
    // Initialize points for all teams
    leagueData.teams.forEach(team => {
        pointsByTeam[team] = 0;
    });
    
    // Process each gameweek
    leagueData.gameweeks.forEach(gameweek => {
        const weekPoints = { ...pointsByTeam };
        
        gameweek.fixtures.forEach(fixture => {
            const homePoints = getPointsForResult(fixture.home_score, fixture.away_score);
            const awayPoints = getPointsForResult(fixture.away_score, fixture.home_score);
            
            pointsByTeam[fixture.home] = (pointsByTeam[fixture.home] || 0) + homePoints;
            pointsByTeam[fixture.away] = (pointsByTeam[fixture.away] || 0) + awayPoints;
            
            weekPoints[fixture.home] = pointsByTeam[fixture.home];
            weekPoints[fixture.away] = pointsByTeam[fixture.away];
        });
        
        gameweekPoints.push(weekPoints);
    });
    
    return gameweekPoints;
}

/**
 * Get points for a match result (Win = 3, Draw = 1, Loss = 0)
 */
function getPointsForResult(teamScore, opponentScore) {
    if (teamScore > opponentScore) return 3;
    if (teamScore === opponentScore) return 1;
    return 0;
}

/**
 * Get fixture information for a team in a specific gameweek
 */
function getTeamFixtureInGameweek(team, gameweekIndex) {
    const gameweek = leagueData.gameweeks[gameweekIndex];
    if (!gameweek) return null;
    
    const fixture = gameweek.fixtures.find(f => 
        f.home === team || f.away === team
    );
    
    if (!fixture) return null;
    
    const isHome = fixture.home === team;
    const opponent = isHome ? fixture.away : fixture.home;
    const teamScore = isHome ? fixture.home_score : fixture.away_score;
    const opponentScore = isHome ? fixture.away_score : fixture.home_score;
    const points = getPointsForResult(teamScore, opponentScore);
    
    return {
        opponent,
        teamScore,
        opponentScore,
        points,
        isHome
    };
}

/**
 * Render the cumulative points chart using Plotly
 */
function renderChart() {
    const cumulativePoints = calculateCumulativePoints();
    const gameweeks = leagueData.gameweeks.map(gw => gw.week);
    
    // Prepare data for each team
    const traces = leagueData.teams.map(team => {
        const points = cumulativePoints.map((weekPoints, index) => {
            const fixture = getTeamFixtureInGameweek(team, index);
            return {
                x: gameweeks[index],
                y: weekPoints[team] || 0,
                fixture: fixture,
                gameweekIndex: index
            };
        });
        
        return {
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            name: team,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: teamColors[team],
                width: selectedTeam === team ? 4 : 2
            },
            marker: {
                size: selectedTeam === team ? 10 : 6,
                color: teamColors[team]
            },
            hovertemplate: 
                '<b>%{fullData.name}</b><br>' +
                'Gameweek %{x}<br>' +
                'Cumulative Points: %{y}<br>' +
                '%{customdata}<extra></extra>',
            customdata: points.map(p => {
                if (p.fixture) {
                    const vs = p.fixture.isHome ? 'vs' : '@';
                    return `${vs} ${p.fixture.opponent}: ${p.fixture.teamScore}-${p.fixture.opponentScore} (${p.fixture.points} pts)`;
                }
                return 'No fixture';
            }),
            // Store gameweek indices for event handlers
            gameweekIndices: points.map(p => p.gameweekIndex)
        };
    });
    
    const layout = {
        title: {
            text: 'Cumulative Points Progression',
            font: { size: 20, color: '#00d4ff' }
        },
        xaxis: {
            title: { text: 'Gameweek', font: { color: '#b8c5d6' } },
            gridcolor: '#2a3441',
            color: '#b8c5d6'
        },
        yaxis: {
            title: { text: 'Cumulative Points', font: { color: '#b8c5d6' } },
            gridcolor: '#2a3441',
            color: '#b8c5d6'
        },
        plot_bgcolor: 'rgba(0, 0, 0, 0)',
        paper_bgcolor: 'rgba(0, 0, 0, 0)',
        font: { color: '#ffffff' },
        legend: {
            font: { color: '#b8c5d6' },
            bgcolor: 'rgba(20, 27, 45, 0.8)',
            bordercolor: '#2a3441',
            borderwidth: 1
        },
        hovermode: 'closest',
        margin: { l: 60, r: 30, t: 60, b: 50 }
    };
    
    const config = {
        displayModeBar: true,
        responsive: true,
        displaylogo: false
    };
    
    Plotly.newPlot('points-chart', traces, layout, config);
    
    // Add click event for highlighting teams
    document.getElementById('points-chart').on('plotly_click', (data) => {
        if (data.points && data.points.length > 0) {
            const point = data.points[0];
            const clickedTeam = point.data.name;
            const pointIndex = point.pointNumber;
            const gameweekIndex = point.data.gameweekIndices[pointIndex];
            
            toggleTeamHighlight(clickedTeam);
            
            // Update table to show fixtures for the clicked gameweek
            if (gameweekIndex !== null && gameweekIndex !== undefined) {
                const gameweek = leagueData.gameweeks[gameweekIndex];
                if (gameweek) {
                    updateTable(gameweek.week);
                }
            }
        }
    });
    
    // Add hover event to update table
    document.getElementById('points-chart').on('plotly_hover', (data) => {
        if (data.points && data.points.length > 0) {
            const point = data.points[0];
            const pointIndex = point.pointNumber;
            const gameweekIndex = point.data.gameweekIndices[pointIndex];
            
            if (gameweekIndex !== null && gameweekIndex !== undefined) {
                const gameweek = leagueData.gameweeks[gameweekIndex];
                if (gameweek) {
                    updateTable(gameweek.week);
                }
            }
        }
    });
}

/**
 * Toggle team highlight (brighten selected, dim others)
 */
function toggleTeamHighlight(team) {
    if (selectedTeam === team) {
        // Deselect - reset all teams
        selectedTeam = null;
    } else {
        // Select new team
        selectedTeam = team;
    }
    
    // Re-render chart with updated highlighting
    renderChart();
}

/**
 * Update the fixtures table for a specific gameweek
 */
function updateTable(gameweekNumber) {
    if (!gameweekNumber) {
        document.getElementById('fixtures-tbody').innerHTML = 
            '<tr><td colspan="4" class="no-data">No gameweek selected</td></tr>';
        document.getElementById('selected-gameweek').textContent = '-';
        return;
    }
    
    const gameweek = leagueData.gameweeks.find(gw => gw.week === gameweekNumber);
    
    if (!gameweek || !gameweek.fixtures || gameweek.fixtures.length === 0) {
        document.getElementById('fixtures-tbody').innerHTML = 
            '<tr><td colspan="4" class="no-data">No fixtures for this gameweek</td></tr>';
        document.getElementById('selected-gameweek').textContent = gameweekNumber;
        return;
    }
    
    selectedGameweek = gameweekNumber;
    document.getElementById('selected-gameweek').textContent = gameweekNumber;
    
    const tbody = document.getElementById('fixtures-tbody');
    tbody.innerHTML = '';
    
    gameweek.fixtures.forEach(fixture => {
        const homePoints = getPointsForResult(fixture.home_score, fixture.away_score);
        const awayPoints = getPointsForResult(fixture.away_score, fixture.home_score);
        
        const row = document.createElement('tr');
        
        // Highlight row if it contains the selected team
        if (selectedTeam && (fixture.home === selectedTeam || fixture.away === selectedTeam)) {
            row.style.backgroundColor = 'rgba(0, 212, 255, 0.1)';
            row.style.borderLeft = '3px solid ' + teamColors[selectedTeam];
        }
        
        row.innerHTML = `
            <td class="team-name" style="color: ${teamColors[fixture.home]}">${fixture.home}</td>
            <td class="score">${fixture.home_score} - ${fixture.away_score}</td>
            <td class="team-name" style="color: ${teamColors[fixture.away]}">${fixture.away}</td>
            <td class="points">${homePoints} - ${awayPoints}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

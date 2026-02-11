/**
 * Players Lounge — League Dashboard
 *
 * Features
 *  - Cumulative Points & League Position chart (toggle)
 *  - Hover dims all lines except the hovered team
 *  - Click team pills / league table rows to lock selection
 *  - League table with form (last 5)
 *  - Gameweek fixtures table synced with chart hover
 */

/* ============================
   Global state
   ============================ */
let data = null;                 // raw JSON
let teamColors = {};             // team -> hex
let selectedTeam = null;         // locked highlight
let chartMode = 'points';        // 'points' | 'position'
let selectedGameweek = null;     // currently shown GW
let cumulativeCache = null;      // computed once
let positionCache = null;        // computed once

/* 12 distinct, vibrant colours — easy to tell apart on dark bg */
const PALETTE = [
    '#00cfff',  // cyan
    '#34d399',  // emerald
    '#fbbf24',  // amber
    '#f87171',  // red
    '#a78bfa',  // violet
    '#38bdf8',  // sky
    '#fb923c',  // orange
    '#f472b6',  // pink
    '#4ade80',  // lime
    '#e879f9',  // fuchsia
    '#22d3ee',  // teal
    '#facc15',  // yellow
];

/* ============================
   Init
   ============================ */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/results.json?v=' + Date.now());
        if (!res.ok) throw new Error(res.statusText);
        data = await res.json();
        console.log('Loaded', data.teams.length, 'teams,', data.gameweeks.length, 'gameweeks');

        assignColors();
        renderHeader();
        renderTeamPills();
        computeAll();
        renderChart();
        renderLeagueTable();
        showGameweek(data.gameweeks[data.gameweeks.length - 1].week);
        wireEvents();
    } catch (e) {
        console.error(e);
        document.getElementById('main-chart').innerHTML =
            `<p style="text-align:center;padding:60px 20px;color:var(--red)">
            Failed to load data — ${e.message}<br>
            <small>Hard-refresh (Cmd+Shift+R) or check data/results.json</small></p>`;
    }
});

/* ============================
   Colour assignment
   ============================ */
function assignColors() {
    data.teams.forEach((t, i) => { teamColors[t] = PALETTE[i % PALETTE.length]; });
}

/* ============================
   Header
   ============================ */
function renderHeader() {
    document.getElementById('league-name').textContent = data.league_name || 'League Dashboard';
    document.getElementById('venue').textContent = data.venue || '';
    document.getElementById('last-updated').textContent = data.last_updated || '';
}

/* ============================
   Team Filter Pills
   ============================ */
function renderTeamPills() {
    const wrap = document.getElementById('team-pills');
    // Sort by current points (descending) so best team is first
    const standings = getStandings();
    standings.forEach(row => {
        const pill = document.createElement('button');
        pill.className = 'team-pill';
        pill.dataset.team = row.team;
        pill.innerHTML = `<span class="dot" style="background:${teamColors[row.team]}"></span>${row.team}`;
        pill.addEventListener('click', () => toggleSelection(row.team));
        wrap.appendChild(pill);
    });
}

function refreshPillStates() {
    document.querySelectorAll('.team-pill').forEach(p => {
        const isActive = p.dataset.team === selectedTeam;
        p.classList.toggle('active', isActive);
        if (isActive) {
            p.style.borderColor = teamColors[p.dataset.team];
            p.style.color = teamColors[p.dataset.team];
            p.style.background = `${teamColors[p.dataset.team]}22`;
        } else {
            p.style.borderColor = 'transparent';
            p.style.color = '';
            p.style.background = '';
        }
    });
}

/* ============================
   Computations
   ============================ */
function pts(gf, ga) { return gf > ga ? 3 : gf === ga ? 1 : 0; }

function computeAll() {
    cumulativeCache = computeCumulative();
    positionCache = computePositions();
}

function computeCumulative() {
    const totals = {};
    data.teams.forEach(t => { totals[t] = 0; });
    return data.gameweeks.map(gw => {
        gw.fixtures.forEach(f => {
            totals[f.home] += pts(f.home_score, f.away_score);
            totals[f.away] += pts(f.away_score, f.home_score);
        });
        return { ...totals };
    });
}

function computePositions() {
    return cumulativeCache.map(weekSnap => {
        const sorted = data.teams
            .map(t => ({ team: t, pts: weekSnap[t] }))
            .sort((a, b) => b.pts - a.pts);
        const positions = {};
        sorted.forEach((row, i) => { positions[row.team] = i + 1; });
        return positions;
    });
}

/* ============================
   Standings (for table)
   ============================ */
function getStandings() {
    const map = {};
    data.teams.forEach(t => {
        map[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, results: [] };
    });
    data.gameweeks.forEach(gw => {
        gw.fixtures.forEach(f => {
            const hp = pts(f.home_score, f.away_score);
            const ap = pts(f.away_score, f.home_score);
            // Home
            const h = map[f.home]; h.p++; h.gf += f.home_score; h.ga += f.away_score; h.pts += hp;
            if (hp === 3) h.w++; else if (hp === 1) h.d++; else h.l++;
            h.results.push(hp === 3 ? 'W' : hp === 1 ? 'D' : 'L');
            // Away
            const a = map[f.away]; a.p++; a.gf += f.away_score; a.ga += f.home_score; a.pts += ap;
            if (ap === 3) a.w++; else if (ap === 1) a.d++; else a.l++;
            a.results.push(ap === 3 ? 'W' : ap === 1 ? 'D' : 'L');
        });
    });
    return Object.values(map)
        .map(r => ({ ...r, gd: r.gf - r.ga }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

/* ============================
   Chart
   ============================ */
function renderChart() {
    const isPosition = chartMode === 'position';
    const cache = isPosition ? positionCache : cumulativeCache;
    const gwNums = data.gameweeks.map(gw => gw.week);

    const traces = data.teams.map(team => {
        const ys = cache.map(snap => snap[team]);
        const customdata = data.gameweeks.map((gw, i) => {
            const f = gw.fixtures.find(f => f.home === team || f.away === team);
            if (!f) return { text: '', gwIdx: i };
            const isHome = f.home === team;
            const ts = isHome ? f.home_score : f.away_score;
            const os = isHome ? f.away_score : f.home_score;
            const opp = isHome ? f.away : f.home;
            const p = pts(ts, os);
            const loc = isHome ? 'vs' : '@';
            return {
                text: `${loc} ${opp}  ${ts}–${os}  (${p} pts)`,
                gwIdx: i
            };
        });

        const isSelected = selectedTeam === team;
        const dimmed = selectedTeam && !isSelected;

        return {
            x: gwNums,
            y: ys,
            customdata,
            name: team,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: teamColors[team],
                width: isSelected ? 4 : 2,
                shape: 'spline',
            },
            marker: {
                size: isSelected ? 9 : 5,
                color: teamColors[team],
            },
            opacity: dimmed ? 0.12 : (isSelected ? 1 : 0.85),
            hovertemplate:
                '<b>%{fullData.name}</b><br>' +
                (isPosition ? 'Position: %{y}<br>' : 'Points: %{y}<br>') +
                'GW %{x}<br>' +
                '%{customdata.text}' +
                '<extra></extra>',
        };
    });

    const layout = {
        xaxis: {
            title: { text: 'Gameweek', font: { size: 12, color: '#7b8ba3' } },
            gridcolor: '#1e293b',
            color: '#7b8ba3',
            dtick: 1,
            fixedrange: true,
        },
        yaxis: {
            title: {
                text: isPosition ? 'Position' : 'Cumulative Points',
                font: { size: 12, color: '#7b8ba3' }
            },
            gridcolor: '#1e293b',
            color: '#7b8ba3',
            autorange: isPosition ? 'reversed' : true,
            dtick: isPosition ? 1 : undefined,
            fixedrange: true,
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#e8ecf1', size: 11 },
        showlegend: false,
        hovermode: 'closest',
        margin: { l: 48, r: 16, t: 10, b: 44 },
    };

    const config = { displayModeBar: false, responsive: true };
    Plotly.newPlot('main-chart', traces, layout, config);

    // --- Hover: dim others, brighten hovered ---
    const chartEl = document.getElementById('main-chart');

    chartEl.on('plotly_hover', ev => {
        if (!ev.points || !ev.points.length) return;
        const hovered = ev.points[0];
        const hoveredTeam = hovered.data.name;
        const gwIdx = hovered.customdata.gwIdx;

        // Dim all traces except hovered (and selected if locked)
        const update = { opacity: [] };
        traces.forEach((tr, i) => {
            const isHovered = tr.name === hoveredTeam;
            const isLocked = selectedTeam && tr.name === selectedTeam;
            update.opacity.push(isHovered ? 1 : (isLocked ? 0.7 : 0.10));
        });
        Plotly.restyle(chartEl, { opacity: update.opacity });

        // Update fixtures table
        const gw = data.gameweeks[gwIdx];
        if (gw) showGameweek(gw.week);
    });

    chartEl.on('plotly_unhover', () => {
        // Restore opacities based on selection state
        const update = { opacity: [] };
        traces.forEach(tr => {
            if (!selectedTeam) {
                update.opacity.push(0.85);
            } else {
                update.opacity.push(tr.name === selectedTeam ? 1 : 0.12);
            }
        });
        Plotly.restyle(chartEl, { opacity: update.opacity });
    });

    chartEl.on('plotly_click', ev => {
        if (!ev.points || !ev.points.length) return;
        toggleSelection(ev.points[0].data.name);
    });
}

/* ============================
   League Table
   ============================ */
function renderLeagueTable() {
    const standings = getStandings();
    const tbody = document.getElementById('league-tbody');
    tbody.innerHTML = '';

    standings.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.team = row.team;
        if (row.team === selectedTeam) tr.classList.add('selected-row');

        const form = row.results.slice(-5);

        tr.innerHTML = `
            <td class="pos-cell">${idx + 1}</td>
            <td class="team-cell">
                <span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${teamColors[row.team]};margin-right:6px;vertical-align:middle"></span>
                ${row.team}
            </td>
            <td class="num-cell">${row.p}</td>
            <td class="num-cell">${row.w}</td>
            <td class="num-cell">${row.d}</td>
            <td class="num-cell">${row.l}</td>
            <td class="num-cell">${row.gf}</td>
            <td class="num-cell">${row.ga}</td>
            <td class="num-cell" style="color:${row.gd > 0 ? 'var(--green)' : row.gd < 0 ? 'var(--red)' : 'var(--text-dim)'}">${row.gd > 0 ? '+' : ''}${row.gd}</td>
            <td class="pts-cell">${row.pts}</td>
            <td class="num-cell">
                <div class="form-dots">${form.map(r => `<span class="form-dot ${r}">${r}</span>`).join('')}</div>
            </td>
        `;

        tr.addEventListener('click', () => toggleSelection(row.team));
        tbody.appendChild(tr);
    });
}

function refreshLeagueTableHighlight() {
    document.querySelectorAll('#league-tbody tr').forEach(tr => {
        tr.classList.toggle('selected-row', tr.dataset.team === selectedTeam);
    });
}

/* ============================
   Gameweek Fixtures Table
   ============================ */
function showGameweek(weekNum) {
    if (!weekNum) return;
    const gw = data.gameweeks.find(g => g.week === weekNum);
    if (!gw) return;

    selectedGameweek = weekNum;
    document.getElementById('selected-gameweek').textContent = weekNum;
    document.getElementById('gw-date').textContent = gw.date ? formatDate(gw.date) : '';

    const tbody = document.getElementById('fixtures-tbody');
    tbody.innerHTML = '';

    gw.fixtures.forEach(f => {
        const hp = pts(f.home_score, f.away_score);
        const ap = pts(f.away_score, f.home_score);
        const tr = document.createElement('tr');

        const involved = selectedTeam && (f.home === selectedTeam || f.away === selectedTeam);
        if (involved) tr.classList.add('selected-fixture');

        // Determine winner for bold styling
        const homeWon = f.home_score > f.away_score;
        const awayWon = f.away_score > f.home_score;

        tr.innerHTML = `
            <td class="home-cell" style="color:${teamColors[f.home]};opacity:${homeWon ? 1 : 0.7}">
                ${f.home}
                <small style="color:var(--text-dim);margin-left:4px">(${hp})</small>
            </td>
            <td class="score-cell">${f.home_score} – ${f.away_score}</td>
            <td class="away-cell" style="color:${teamColors[f.away]};opacity:${awayWon ? 1 : 0.7}">
                ${f.away}
                <small style="color:var(--text-dim);margin-left:4px">(${ap})</small>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
}

/* ============================
   Selection / sync
   ============================ */
function toggleSelection(team) {
    selectedTeam = selectedTeam === team ? null : team;
    refreshPillStates();
    refreshLeagueTableHighlight();
    renderChart();                       // re-renders with correct opacities
    if (selectedGameweek) showGameweek(selectedGameweek);  // refresh fixture highlight
}

/* ============================
   Wire up controls
   ============================ */
function wireEvents() {
    // Chart mode toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.mode === chartMode) return;
            chartMode = btn.dataset.mode;
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderChart();
        });
    });

    // Clear filter
    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        selectedTeam = null;
        refreshPillStates();
        refreshLeagueTableHighlight();
        renderChart();
        if (selectedGameweek) showGameweek(selectedGameweek);
    });
}

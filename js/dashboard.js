/**
 * Players Lounge — League Dashboard v2
 *
 *  - Cumulative Points / League Position toggle
 *  - Hover: all lines dim, hovered team bright
 *  - Click pills / league table / chart to lock selection
 *  - League table with last-5 form
 *  - Gameweek fixtures table synced with chart hover
 *  - Poisson prediction model → predicted scores + projected chart lines
 *  - Upcoming Colonel Getafe fixtures
 */

/* ============================================================
   Global state
   ============================================================ */
let data = null;
let teamColors = {};
let selectedTeam = null;
let chartMode = 'points';       // 'points' | 'position'
let selectedGameweek = null;
let showProjections = true;

// Caches (computed once after load)
let cumulativeCache = null;
let positionCache = null;
let predictions = null;         // { fixtures: [...], projectedCumulative: [...], projectedPositions: [...] }

const PALETTE = [
    '#00cfff', '#34d399', '#fbbf24', '#f87171',
    '#a78bfa', '#38bdf8', '#fb923c', '#f472b6',
    '#4ade80', '#e879f9', '#22d3ee', '#facc15',
];

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/results.json?v=' + Date.now());
        if (!res.ok) throw new Error(res.statusText);
        data = await res.json();
        console.log('Loaded', data.teams.length, 'teams,', data.gameweeks.length, 'GWs');

        assignColors();
        renderHeader();
        renderTeamPills();
        computeAll();
        renderChart();
        renderLeagueTable();
        showGameweekTable(data.gameweeks[data.gameweeks.length - 1].week);
        renderPredictions();
        renderUpcoming();
        wireEvents();
    } catch (e) {
        console.error(e);
        document.getElementById('main-chart').innerHTML =
            `<p style="text-align:center;padding:60px 20px;color:var(--red)">
            Failed to load — ${e.message}</p>`;
    }
});

/* ============================================================
   Colours
   ============================================================ */
function assignColors() {
    data.teams.forEach((t, i) => { teamColors[t] = PALETTE[i % PALETTE.length]; });
}

/* ============================================================
   Header
   ============================================================ */
function renderHeader() {
    document.getElementById('league-name').textContent = data.league_name || 'League Dashboard';
    document.getElementById('venue').textContent = data.venue || '';
    document.getElementById('last-updated').textContent = data.last_updated || '';
}

/* ============================================================
   Team Pills
   ============================================================ */
function renderTeamPills() {
    const wrap = document.getElementById('team-pills');
    getStandings().forEach(row => {
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
        const on = p.dataset.team === selectedTeam;
        p.classList.toggle('active', on);
        p.style.borderColor = on ? teamColors[p.dataset.team] : 'transparent';
        p.style.color      = on ? teamColors[p.dataset.team] : '';
        p.style.background = on ? teamColors[p.dataset.team] + '22' : '';
    });
}

/* ============================================================
   Core computations
   ============================================================ */
function pts(gf, ga) { return gf > ga ? 3 : gf === ga ? 1 : 0; }

function computeAll() {
    cumulativeCache = computeCumulative();
    positionCache   = computePositions(cumulativeCache);
    predictions     = buildPredictions();
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

function computePositions(cumCache) {
    return cumCache.map(snap => {
        const sorted = data.teams
            .map(t => ({ t, p: snap[t] }))
            .sort((a, b) => b.p - a.p);
        const pos = {};
        sorted.forEach((r, i) => { pos[r.t] = i + 1; });
        return pos;
    });
}

/* ============================================================
   Standings (league table data)
   ============================================================ */
function getStandings() {
    const m = {};
    data.teams.forEach(t => {
        m[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, results: [] };
    });
    data.gameweeks.forEach(gw => {
        gw.fixtures.forEach(f => {
            const hp = pts(f.home_score, f.away_score);
            const ap = pts(f.away_score, f.home_score);
            const h = m[f.home]; h.p++; h.gf += f.home_score; h.ga += f.away_score; h.pts += hp;
            h.results.push(hp === 3 ? 'W' : hp === 1 ? 'D' : 'L');
            if (hp === 3) h.w++; else if (hp === 1) h.d++; else h.l++;
            const a = m[f.away]; a.p++; a.gf += f.away_score; a.ga += f.home_score; a.pts += ap;
            a.results.push(ap === 3 ? 'W' : ap === 1 ? 'D' : 'L');
            if (ap === 3) a.w++; else if (ap === 1) a.d++; else a.l++;
        });
    });
    return Object.values(m)
        .map(r => ({ ...r, gd: r.gf - r.ga }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

/* ============================================================
   Poisson Prediction Model
   ============================================================
   For each team we compute:
     attackStrength  = (team goals scored / games played) / leagueAvgGoals
     defenceStrength = (team goals conceded / games played) / leagueAvgGoals

   Expected goals when A plays B:
     λ_A = A_attack * B_defence * leagueAvgGoals * homeAdv
     λ_B = B_attack * A_defence * leagueAvgGoals

   Then we enumerate score grid 0-10 × 0-10 using Poisson PMF
   to get P(home win), P(draw), P(away win) and most likely score.
   ============================================================ */

function poissonPMF(lambda, k) {
    // P(X=k) = e^(-λ) * λ^k / k!
    let logP = -lambda + k * Math.log(lambda);
    for (let i = 2; i <= k; i++) logP -= Math.log(i);
    return Math.exp(logP);
}

function buildPredictions() {
    if (!data.future_gameweeks || data.future_gameweeks.length === 0) return null;

    const standings = getStandings();
    const totalGames = standings.reduce((s, r) => s + r.p, 0) / 2; // each game counted twice
    const totalGoals = standings.reduce((s, r) => s + r.gf, 0);
    const avgGoals = totalGoals / (totalGames * 2); // average goals per team per game

    // Home advantage factor
    let homeGoals = 0, awayGoals = 0, matchCount = 0;
    data.gameweeks.forEach(gw => {
        gw.fixtures.forEach(f => {
            homeGoals += f.home_score;
            awayGoals += f.away_score;
            matchCount++;
        });
    });
    const homeAdv = matchCount > 0 ? (homeGoals / matchCount) / ((homeGoals + awayGoals) / (2 * matchCount)) : 1.1;

    // Per-team strength
    const strength = {};
    standings.forEach(r => {
        const attack  = r.p > 0 ? (r.gf / r.p) / avgGoals : 1;
        const defence = r.p > 0 ? (r.ga / r.p) / avgGoals : 1;
        strength[r.team] = { attack, defence };
    });

    // Predict each future gameweek
    const allPredicted = [];
    const projectedCumulative = [];
    const lastActual = { ...cumulativeCache[cumulativeCache.length - 1] };

    data.future_gameweeks.forEach(fgw => {
        const gwPredictions = [];
        const snapBefore = projectedCumulative.length > 0
            ? { ...projectedCumulative[projectedCumulative.length - 1] }
            : { ...lastActual };

        fgw.fixtures.forEach(f => {
            const sH = strength[f.home] || { attack: 1, defence: 1 };
            const sA = strength[f.away] || { attack: 1, defence: 1 };

            const lambdaH = sH.attack * sA.defence * avgGoals * homeAdv;
            const lambdaA = sA.attack * sH.defence * avgGoals;

            // Enumerate score grid
            let pHome = 0, pDraw = 0, pAway = 0;
            let bestProb = 0, bestH = 0, bestA = 0;
            const MAX = 10;

            for (let h = 0; h <= MAX; h++) {
                const pH = poissonPMF(lambdaH, h);
                for (let a = 0; a <= MAX; a++) {
                    const pA = poissonPMF(lambdaA, a);
                    const p = pH * pA;
                    if (h > a) pHome += p;
                    else if (h === a) pDraw += p;
                    else pAway += p;
                    if (p > bestProb) { bestProb = p; bestH = h; bestA = a; }
                }
            }

            // Expected points
            const expPtsHome = pHome * 3 + pDraw * 1;
            const expPtsAway = pAway * 3 + pDraw * 1;

            snapBefore[f.home] = (snapBefore[f.home] || 0) + expPtsHome;
            snapBefore[f.away] = (snapBefore[f.away] || 0) + expPtsAway;

            gwPredictions.push({
                home: f.home,
                away: f.away,
                time: f.time || '',
                predHome: bestH,
                predAway: bestA,
                pHome: Math.round(pHome * 100),
                pDraw: Math.round(pDraw * 100),
                pAway: Math.round(pAway * 100),
                expPtsHome,
                expPtsAway,
                lambdaH: lambdaH.toFixed(2),
                lambdaA: lambdaA.toFixed(2),
            });
        });

        allPredicted.push({ week: fgw.week, date: fgw.date, fixtures: gwPredictions });
        projectedCumulative.push({ ...snapBefore });
    });

    const projectedPositions = computePositions(projectedCumulative);

    return { gameweeks: allPredicted, projectedCumulative, projectedPositions };
}

/* ============================================================
   Chart
   ============================================================ */
function renderChart() {
    const isPos = chartMode === 'position';
    const histCache = isPos ? positionCache : cumulativeCache;
    const gwNums = data.gameweeks.map(gw => gw.week);

    const traces = [];

    // --- Historical traces (solid) ---
    data.teams.forEach(team => {
        const ys = histCache.map(snap => snap[team]);
        const customdata = data.gameweeks.map((gw, i) => ({ gwIdx: i }));

        const isSel = selectedTeam === team;
        const dimmed = selectedTeam && !isSel;

        traces.push({
            x: gwNums,
            y: ys,
            customdata,
            name: team,
            legendgroup: team,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: teamColors[team], width: isSel ? 4 : 2, shape: 'linear' },
            marker: { size: isSel ? 9 : 5, color: teamColors[team] },
            opacity: dimmed ? 0.12 : (isSel ? 1 : 0.85),
            hovertemplate: '<b>%{fullData.name}</b><extra></extra>',
            showlegend: true,
        });
    });

    // --- Projected traces (dotted) ---
    if (showProjections && predictions && predictions.projectedCumulative.length > 0) {
        const projCache = isPos ? predictions.projectedPositions
                                : predictions.projectedCumulative;
        const projGWs = predictions.gameweeks.map(g => g.week);

        data.teams.forEach(team => {
            // Bridge from last historical point to first projected
            const lastHistY = histCache[histCache.length - 1][team];
            const projYs = projCache.map(snap => snap[team]);

            const isSel = selectedTeam === team;
            const dimmed = selectedTeam && !isSel;

            traces.push({
                x: [gwNums[gwNums.length - 1], ...projGWs],
                y: [lastHistY, ...projYs],
                name: team + ' (proj)',
                legendgroup: team,
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: teamColors[team], width: 2, dash: 'dot', shape: 'linear' },
                marker: { size: 5, color: teamColors[team], symbol: 'diamond-open' },
                opacity: dimmed ? 0.08 : (isSel ? 0.8 : 0.45),
                hovertemplate: '<b>%{fullData.name}</b> (projected)<extra></extra>',
                showlegend: false,
            });
        });
    }

    const layout = {
        xaxis: {
            title: { text: 'Gameweek', font: { size: 12, color: '#7b8ba3' } },
            gridcolor: '#1e293b', color: '#7b8ba3', dtick: 1, fixedrange: true,
        },
        yaxis: {
            title: { text: isPos ? 'Position' : 'Cumulative Points', font: { size: 12, color: '#7b8ba3' } },
            gridcolor: '#1e293b', color: '#7b8ba3',
            autorange: isPos ? 'reversed' : true,
            dtick: isPos ? 1 : undefined,
            fixedrange: true,
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#e8ecf1', size: 11 },
        showlegend: true,
        legend: {
            x: 1.02, y: 1, xanchor: 'left',
            font: { size: 10, color: '#b8c5d6' },
            bgcolor: 'rgba(15,22,41,0.85)',
            bordercolor: '#1e293b', borderwidth: 1,
            tracegroupgap: 2,
        },
        hovermode: 'closest',
        margin: { l: 48, r: 140, t: 10, b: 44 },
    };

    const config = { displayModeBar: false, responsive: true };
    Plotly.newPlot('main-chart', traces, layout, config);

    // --- Hover behaviour: dim all, brighten hovered ---
    const chartEl = document.getElementById('main-chart');

    chartEl.on('plotly_hover', ev => {
        if (!ev.points || !ev.points.length) return;
        const hoveredName = ev.points[0].data.name.replace(' (proj)', '');
        const gwIdx = ev.points[0].customdata ? ev.points[0].customdata.gwIdx : null;

        const opacities = traces.map(tr => {
            const tName = tr.name.replace(' (proj)', '');
            const isHov = tName === hoveredName;
            const isLocked = selectedTeam && tName === selectedTeam;
            const isProj = tr.name.includes('(proj)');
            if (isHov) return isProj ? 0.8 : 1;
            if (isLocked) return isProj ? 0.5 : 0.7;
            return isProj ? 0.04 : 0.08;
        });
        Plotly.restyle(chartEl, { opacity: opacities });

        if (gwIdx !== null && gwIdx !== undefined) {
            const gw = data.gameweeks[gwIdx];
            if (gw) showGameweekTable(gw.week);
        }
    });

    chartEl.on('plotly_unhover', () => {
        const opacities = traces.map(tr => {
            const tName = tr.name.replace(' (proj)', '');
            const isProj = tr.name.includes('(proj)');
            if (!selectedTeam) return isProj ? 0.45 : 0.85;
            const isSel = tName === selectedTeam;
            if (isSel) return isProj ? 0.8 : 1;
            return isProj ? 0.08 : 0.12;
        });
        Plotly.restyle(chartEl, { opacity: opacities });
    });

    chartEl.on('plotly_click', ev => {
        if (!ev.points || !ev.points.length) return;
        const name = ev.points[0].data.name.replace(' (proj)', '');
        toggleSelection(name);
    });
}

/* ============================================================
   League Table
   ============================================================ */
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
            </td>`;
        tr.addEventListener('click', () => toggleSelection(row.team));
        tbody.appendChild(tr);
    });
}

function refreshLeagueTableHighlight() {
    document.querySelectorAll('#league-tbody tr').forEach(tr => {
        tr.classList.toggle('selected-row', tr.dataset.team === selectedTeam);
    });
}

/* ============================================================
   Gameweek Fixtures Table
   ============================================================ */
function showGameweekTable(weekNum) {
    if (!weekNum) return;
    const gw = data.gameweeks.find(g => g.week === weekNum);
    if (!gw) return;

    selectedGameweek = weekNum;
    document.getElementById('selected-gameweek').textContent = weekNum;
    document.getElementById('gw-date').textContent = gw.date ? fmtDate(gw.date) : '';

    const tbody = document.getElementById('fixtures-tbody');
    tbody.innerHTML = '';

    gw.fixtures.forEach(f => {
        const hp = pts(f.home_score, f.away_score);
        const ap = pts(f.away_score, f.home_score);
        const tr = document.createElement('tr');
        if (selectedTeam && (f.home === selectedTeam || f.away === selectedTeam))
            tr.classList.add('selected-fixture');

        const hWon = f.home_score > f.away_score;
        const aWon = f.away_score > f.home_score;

        tr.innerHTML = `
            <td class="home-cell" style="color:${teamColors[f.home]};opacity:${hWon ? 1 : 0.7}">
                ${f.home} <small style="color:var(--text-dim);margin-left:4px">(${hp})</small>
            </td>
            <td class="score-cell">${f.home_score} – ${f.away_score}</td>
            <td class="away-cell" style="color:${teamColors[f.away]};opacity:${aWon ? 1 : 0.7}">
                ${f.away} <small style="color:var(--text-dim);margin-left:4px">(${ap})</small>
            </td>`;
        tbody.appendChild(tr);
    });
}

/* ============================================================
   Predictions Table
   ============================================================ */
function renderPredictions() {
    if (!predictions || !predictions.gameweeks.length) {
        document.getElementById('predictions-section').style.display = 'none';
        return;
    }
    const gw = predictions.gameweeks[0]; // next future GW
    document.getElementById('pred-gw-num').textContent = gw.week;

    const tbody = document.getElementById('predictions-tbody');
    tbody.innerHTML = '';

    gw.fixtures.forEach(f => {
        const tr = document.createElement('tr');
        if (selectedTeam && (f.home === selectedTeam || f.away === selectedTeam))
            tr.classList.add('selected-fixture');

        const homeWins = f.pHome > f.pAway;
        const awayWins = f.pAway > f.pHome;

        tr.innerHTML = `
            <td class="home-cell" style="color:${teamColors[f.home]};opacity:${homeWins ? 1 : 0.7}">
                ${f.home}
            </td>
            <td class="score-cell">${f.predHome} – ${f.predAway}</td>
            <td class="away-cell" style="color:${teamColors[f.away]};opacity:${awayWins ? 1 : 0.7}">
                ${f.away}
            </td>
            <td class="pct-cell" style="color:${homeWins ? 'var(--green)' : ''}">${f.pHome}%</td>
            <td class="pct-cell">${f.pDraw}%</td>
            <td class="pct-cell" style="color:${awayWins ? 'var(--green)' : ''}">${f.pAway}%</td>`;
        tbody.appendChild(tr);
    });
}

/* ============================================================
   Upcoming Fixtures — Colonel Getafe
   ============================================================ */
function renderUpcoming() {
    if (!data.future_gameweeks || !data.future_gameweeks.length) {
        document.getElementById('upcoming-section').style.display = 'none';
        return;
    }

    const wrap = document.getElementById('upcoming-fixtures');
    wrap.innerHTML = '';

    data.future_gameweeks.forEach(fgw => {
        fgw.fixtures.forEach(f => {
            if (f.home !== 'Colonel Getafe' && f.away !== 'Colonel Getafe') return;

            const card = document.createElement('div');
            card.className = 'upcoming-card';

            const dateStr = fgw.date ? fmtDate(fgw.date) : '';
            const timeStr = f.time || '';

            const isHome = f.home === 'Colonel Getafe';
            const opponent = isHome ? f.away : f.home;
            const loc = isHome ? 'vs' : '@';

            card.innerHTML = `
                <div class="ko-time">${dateStr}<br><strong>${timeStr}</strong></div>
                <div class="matchup">
                    <span style="color:${teamColors['Colonel Getafe']}">Colonel Getafe</span>
                    <span class="vs">${loc}</span>
                    <span style="color:${teamColors[opponent]}">${opponent}</span>
                </div>`;
            wrap.appendChild(card);
        });
    });

    if (!wrap.children.length) {
        wrap.innerHTML = '<p class="no-data">No upcoming fixtures</p>';
    }
}

/* ============================================================
   Helpers
   ============================================================ */
function fmtDate(s) {
    try {
        const d = new Date(s + 'T00:00:00');
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return s; }
}

/* ============================================================
   Selection / sync
   ============================================================ */
function toggleSelection(team) {
    selectedTeam = selectedTeam === team ? null : team;
    refreshPillStates();
    refreshLeagueTableHighlight();
    renderChart();
    if (selectedGameweek) showGameweekTable(selectedGameweek);
    renderPredictions();
}

/* ============================================================
   Wire up controls
   ============================================================ */
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

    // Projections toggle
    document.getElementById('show-projections').addEventListener('change', e => {
        showProjections = e.target.checked;
        renderChart();
    });

    // Clear filter
    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        selectedTeam = null;
        refreshPillStates();
        refreshLeagueTableHighlight();
        renderChart();
        if (selectedGameweek) showGameweekTable(selectedGameweek);
        renderPredictions();
    });
}

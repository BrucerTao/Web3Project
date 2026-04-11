const $ = (sel) => document.querySelector(sel);

// ETH 到 USD 的固定汇率（演示用，实际可从 API 获取）
const ETH_USD_RATE = 2000;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.data = data;
    throw err;
  }
  return data;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function riskClass(level) {
  const l = String(level || '').toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(l)) return l;
  return 'medium';
}

// wei 转 ETH
function weiToEth(wei) {
  if (!wei) return '0';
  const eth = BigInt(wei) / BigInt('1000000000000000000');
  const remainder = BigInt(wei) % BigInt('1000000000000000000');
  const decimal = Number(remainder) / 1e18;
  return `${eth}.${decimal.toFixed(6).slice(2)}`;
}

// ETH 转 USD
function ethToUsd(eth) {
  return (parseFloat(eth) * ETH_USD_RATE).toFixed(2);
}

async function loadState() {
  const s = await api('/api/state');
  $('#chain-pill').textContent = `Chain ${s.chainId}`;
  $('#kv-address').textContent = s.walletAddress;
  $('#kv-agent').textContent = s.agentId;
  $('#kv-session').textContent = s.sessionId;
  $('#kv-policy').textContent = s.policyId;

  const ex = $('#explorer-link');
  ex.href = s.explorerUrl || '#';

  const p = s.policy;
  if (p) {
    const form = $('#form-policy');
    form.maxSinglePayment.value = p.maxSinglePayment ?? '';
    form.dailyBudget.value = p.dailyBudget ?? '';
    form.weeklyBudget.value = p.weeklyBudget ?? '';
    form.requireHumanAbove.value = p.requireHumanAbove ?? '';
  }

  // 更新 ETH 汇率显示
  $('#eth-price-display').textContent = `1 ETH ≈ ${ETH_USD_RATE} USD`;
}

async function loadStats() {
  const st = await api('/api/stats');
  $('#stats-line').textContent = `总交易数：${st.totalPayments} · 成功：${st.successfulPayments} · 失败：${st.failedPayments} · 总交易量：${st.totalVolume}`;
}

function renderAudit(logs) {
  const tb = $('#audit-body');
  tb.innerHTML = '';
  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  for (const log of sorted) {
    const tr = document.createElement('tr');
    const pr = log.paymentRequest || {};
    const ok = log.paymentResult?.success;
    const hum = log.paymentResult?.requiredHumanApproval;

    // 计算金额（wei -> ETH -> USD）
    const amountWei = pr.amount || '0';
    const amountEth = weiToEth(amountWei);
    const amountUsd = ethToUsd(amountEth);

    // 状态显示
    let statusText = ok ? '成功' : '未成功';
    let statusClass = ok ? 'ok' : 'fail';

    // 如果需要人工审批但未成功，显示"待审批"
    if (hum && !ok) {
      statusText = '待审批';
      statusClass = 'fail';
    }

    // 发款地址（从 sessionId 或 state 获取，这里显示 agentId 作为发款方标识）
    const payerAddress = log.agentId || '—';

    tr.innerHTML = `
      <td>${fmtTime(log.timestamp)}</td>
      <td>${log.id}</td>
      <td><span class="risk ${riskClass(log.riskLevel)}">${log.riskLevel === 'low' ? '低' : log.riskLevel === 'medium' ? '中' : log.riskLevel === 'high' ? '高' : '严重'}</span></td>
      <td>${amountEth}</td>
      <td>$${amountUsd}</td>
      <td title="${pr.recipient || ''}">${(pr.recipient || '').slice(0, 10)}…</td>
      <td title="${payerAddress}">${payerAddress.slice(0, 10)}…</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>${hum ? '是' : '否'}</td>
    `;
    tb.appendChild(tr);
  }
}

async function loadAudit() {
  const { logs } = await api('/api/audit?limit=120');
  renderAudit(logs || []);
}

function renderPending(items) {
  const root = $('#pending-list');
  root.innerHTML = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '暂无待审批的支付。你可以提高「超过多少需要人工审批」的阈值，然后发起一笔较大金额的支付来测试。';
    root.appendChild(p);
    return;
  }
  for (const log of items) {
    const pr = log.paymentRequest || {};
    const el = document.createElement('div');
    el.className = 'pending-item';
    el.innerHTML = `
      <div>
        <div class="title">${pr.reason || '支付请求'}</div>
        <div class="meta">${log.id} · 收款方：${pr.recipient || ''}</div>
      </div>
      <div class="pending-actions">
        <button type="button" class="btn small danger" data-id="${log.id}" data-act="reject">拒绝</button>
        <button type="button" class="btn small primary" data-id="${log.id}" data-act="approve">批准</button>
      </div>
    `;
    root.appendChild(el);
  }

  root.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      const approved = act === 'approve';
      await api('/api/approve', {
        method: 'POST',
        body: JSON.stringify({ auditLogId: id, approved }),
      });
      await refreshAll();
    });
  });
}

async function loadPending() {
  const { items } = await api('/api/pending');
  renderPending(items || []);
}

async function refreshAll() {
  await loadState();
  await loadStats();
  await loadAudit();
  await loadPending();
}

$('#form-policy').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    maxSinglePayment: Number(f.maxSinglePayment.value),
    dailyBudget: Number(f.dailyBudget.value),
    weeklyBudget: Number(f.weeklyBudget.value),
    requireHumanAbove: Number(f.requireHumanAbove.value),
  };
  await api('/api/policy', { method: 'PATCH', body: JSON.stringify(body) });
  await refreshAll();
});

$('#form-pay').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const out = $('#pay-result');
  out.textContent = '提交中…';
  try {
    const body = {
      recipient: f.recipient.value.trim(),
      amountEth: Number(f.amountEth.value),
      reason: f.reason.value.trim(),
    };
    const r = await api('/api/payment', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    out.textContent = JSON.stringify(r, null, 2);
  } catch (err) {
    out.textContent = err.message + (err.data ? '\n' + JSON.stringify(err.data, null, 2) : '');
  }
  await refreshAll();
});

// ETH 输入实时转换为 USD
$('#amount-eth-input').addEventListener('input', (e) => {
  const ethValue = parseFloat(e.target.value) || 0;
  const usdValue = (ethValue * ETH_USD_RATE).toFixed(2);
  $('#amount-usd-display').value = usdValue > 0 ? `$${usdValue}` : '';
});

$('#btn-refresh').addEventListener('click', () => refreshAll());

let timer;
$('#auto-refresh').addEventListener('change', (e) => {
  clearInterval(timer);
  if (e.target.checked) {
    timer = setInterval(refreshAll, 5000);
  }
});

// ========== 初始化模态框逻辑 ==========

const modal = $('#init-modal');
const panelKey = $('#panel-key');
const panelRandom = $('#panel-random');
const initStatus = $('#init-status');

function showStatus(msg, isError = false) {
  initStatus.style.display = 'block';
  initStatus.textContent = msg;
  initStatus.style.background = isError ? '#3d1f1f' : '#1f3d2f';
  initStatus.style.color = isError ? '#ff9999' : '#99ffcc';
}

// 切换模式
$('#btn-mode-key').addEventListener('click', () => {
  panelKey.style.display = 'block';
  panelRandom.style.display = 'none';
  $('#btn-mode-key').classList.add('primary');
  $('#btn-mode-key').classList.remove('ghost');
  $('#btn-mode-random').classList.remove('primary');
  $('#btn-mode-random').classList.add('ghost');
  initStatus.style.display = 'none';
});

$('#btn-mode-random').addEventListener('click', () => {
  panelRandom.style.display = 'block';
  panelKey.style.display = 'none';
  $('#btn-mode-random').classList.add('primary');
  $('#btn-mode-random').classList.remove('ghost');
  $('#btn-mode-key').classList.remove('primary');
  $('#btn-mode-key').classList.add('ghost');
  initStatus.style.display = 'none';
});

// 使用私钥初始化
$('#btn-init-with-key').addEventListener('click', async () => {
  const privateKey = $('#init-private-key').value.trim();
  if (!privateKey || !privateKey.startsWith('0x')) {
    showStatus('请输入有效的私钥（必须以 0x 开头）', true);
    return;
  }
  try {
    const result = await api('/api/init', {
      method: 'POST',
      body: JSON.stringify({ privateKey }),
    });
    showStatus(`✅ 钱包已连接：${result.walletAddress.slice(0, 10)}...`);
    setTimeout(() => {
      modal.style.display = 'none';
      refreshAll();
    }, 1000);
  } catch (err) {
    showStatus(err.message || '连接失败', true);
  }
});

// 生成随机钱包
$('#btn-init-random').addEventListener('click', async () => {
  try {
    const result = await api('/api/init', {
      method: 'POST',
      body: JSON.stringify({ generateRandom: true }),
    });
    showStatus(`✅ 已生成随机钱包：${result.walletAddress.slice(0, 10)}...`);
    setTimeout(() => {
      modal.style.display = 'none';
      refreshAll();
    }, 1000);
  } catch (err) {
    showStatus(err.message || '生成失败', true);
  }
});

// 检查是否已初始化
async function checkInitialized() {
  try {
    const status = await api('/api/initialized');
    if (status.initialized) {
      // 已初始化，直接加载页面
      modal.style.display = 'none';
      refreshAll().catch((err) => {
        $('#pay-result').textContent = String(err);
      });
    } else {
      // 未初始化，显示模态框
      modal.style.display = 'flex';
    }
  } catch (err) {
    console.error('检查初始化状态失败:', err);
    modal.style.display = 'flex';
  }
}

// 页面加载时检查
checkInitialized();

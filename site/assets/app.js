/* 纯静态快照站：无框架、无外部依赖。
   页面文案全部来自 content.json；读取失败时使用下面的内置默认值，保证不白屏。 */
(function () {
  'use strict';

  var DEFAULT_CONTENT = {
    meta: {
      title: '苹果与葡萄叶片病害识别 · 预计算快照',
      description: '纯静态演示页：1679 张 test 与 holdout 叶片的预计算识别结果，不联网、不上传图片。'
    },
    topbar: {
      brandKicker: '病害标本档案 · HERBARIUM',
      brandTitle: '苹果与葡萄叶片识别',
      mode: '演示模式 · 预计算快照（此页不连推理服务，不上传新图）'
    },
    hero: {
      eyebrow: 'STATIC SNAPSHOT',
      title: '一片叶子的七种身份',
      subtitle: '把 test 集与 holdout 集的叶片缩略图摊开，按预测类别、来源与文件名逐一查验。',
      coverNote: '这里没有实时推理：每张图的类别与概率都是提前算好的。它适合展示模型在固定数据上的表现，不适合当成现场诊断工具。'
    },
    metrics: {
      val: { label: '验证集最佳准确率', value: '99.16', unit: '%', detail: '836 张 · 训练第 30 轮' },
      holdout: { label: '留出集准确率', value: '99.79', unit: '%', detailTpl: '{n} 张 · {wrong} 张判错' },
      snapshot: { label: '快照样本总数', value: '1679', unit: '张', detailTpl: 'test {test} + holdout {holdout}' }
    },
    classesTitle: { title: '7 类索引', hint: '点任意一类，按预测结果筛选样本' },
    filters: {
      sourceLabel: '来源', sourceAll: '全部', sourceTest: 'test', sourceHoldout: 'holdout',
      classAll: '全部 7 类', wrong: '只看判错的',
      searchLabel: '搜索文件名', searchPlaceholder: '输入文件名，如 0 (239).JPG', reset: '重置筛选'
    },
    actions: {
      random: '随机抽 12 张', resample: '重新抽 12 张', closeSample: '收起抽样',
      close: '关闭', detail: '查看详情'
    },
    results: {
      countTpl: '当前 {shown} 张 / 共 {total} 张',
      sampleTitle: '随机抽样 12 张',
      sampleHint: '每次从全部样本里随机取 12 张，模拟原页面的抽样演示；点卡片仍可看详情。',
      empty: '没有符合条件的样本，试试「重置筛选」。', more: '继续加载'
    },
    detail: {
      title: '样本详情', source: '来源', file: '文件名', conf: '模型置信度', pred: '预测',
      truth: '真值', truthTest: '真值：未提供（test 集没有标注）',
      agree: '✓ 一致', disagree: '✕ 不一致', probs: '7 类概率（降序）', top3: 'Top-3', close: '关闭'
    },
    card: { conf: '置信度', wrong: '判错', view: '查看详情' },
    offline: {
      dataNote: '当前以 file:// 直接打开：浏览器拦截了本地 JSON 读取，已切换为内置的 30 张样例与内置文案。要看完整 1679 张，请用本地服务器打开 site/。',
      contentNote: '未能读取 content.json，页面使用内置默认文案。'
    },
    footer: {
      boundaryTitle: '适用边界',
      boundary: [
        '本页只展示 test 与 holdout 的预计算推理结果，不接收上传图片，也不连接推理服务。',
        'test 集未提供真值标注，页面不会给出对错判断；holdout 的 466 张含标注，可用于核对。',
        '7 类覆盖苹果与葡萄叶片，其他作物、其他病害或非叶片图片不在适用范围内。',
        '准确率来自固定测试集，不能等同于田间诊断准确率；结果不构成植保建议。',
        '缩略图为 256×256 JPEG，仅用于浏览，不能据此复核原始分辨率细节。'
      ],
      disclaimer: '免责声明：本页是课程项目的离线演示快照，不提供实时诊断、不承担生产决策依据。',
      note: '数据：本项目 test 集 1213 张 + holdout 集 466 张；快照生成于 2026-11-04，模型更新后不会自动重算。',
      credit: '模型 se_residual · 输入 224×224 · 参数量 2.799M'
    },
    classes: [
      { key: 'Apple___Apple_scab', cn: '苹果黑星病', latin: 'Venturia inaequalis', host: '苹果' },
      { key: 'Apple___Black_rot', cn: '苹果黑腐病', latin: 'Botryosphaeria obtusa', host: '苹果' },
      { key: 'Apple___Cedar_apple_rust', cn: '苹果雪松锈病', latin: 'Gymnosporangium juniperi-virginianae', host: '苹果' },
      { key: 'Apple___healthy', cn: '苹果健康', latin: 'Malus domestica（健康叶片）', host: '苹果' },
      { key: 'Grape___Black_rot', cn: '葡萄黑腐病', latin: 'Guignardia bidwellii', host: '葡萄' },
      { key: 'Grape___healthy', cn: '葡萄健康', latin: 'Vitis vinifera（健康叶片）', host: '葡萄' },
      { key: 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', cn: '葡萄褐斑病', latin: 'Pseudocercospora vitis', host: '葡萄' }
    ]
  };

  var FALLBACK_STATS = {
    test: { n: 1213 },
    holdout: { n: 466, consistent: 465, inconsistent: 1, acc_pct: 99.79 }
  };

  /* 数据读不到时（file:// 场景）使用的内置样例，字段与 manifest.items 相同 */
  var FALLBACK_ITEMS = [{"id":"0001","source":"test","file":"1.jpg","thumb":"thumbs/test_0001.jpg","predicted_class":"Apple___Apple_scab","predicted_cn":"苹果黑星病","confidence":0.9988,"probs":[0.99883,2e-06,0.001139,1.6e-05,8e-06,1e-06,4e-06],"truth_class":null,"truth_cn":null},{"id":"0002","source":"test","file":"2.jpg","thumb":"thumbs/test_0002.jpg","predicted_class":"Apple___Apple_scab","predicted_cn":"苹果黑星病","confidence":0.9922,"probs":[0.992228,0.000138,0.000812,0.006169,0.000452,3.8e-05,0.000163],"truth_class":null,"truth_cn":null},{"id":"0025","source":"test","file":"25.jpg","thumb":"thumbs/test_0025.jpg","predicted_class":"Apple___healthy","predicted_cn":"苹果健康","confidence":0.9082,"probs":[0.078321,0.001143,0.002799,0.908166,0.003564,0.001132,0.004875],"truth_class":null,"truth_cn":null},{"id":"0039","source":"test","file":"39.jpg","thumb":"thumbs/test_0039.jpg","predicted_class":"Apple___healthy","predicted_cn":"苹果健康","confidence":0.7077,"probs":[0.285654,0.000489,0.001014,0.707724,0.004174,9.2e-05,0.000853],"truth_class":null,"truth_cn":null},{"id":"0032","source":"test","file":"32.jpg","thumb":"thumbs/test_0032.jpg","predicted_class":"Apple___Black_rot","predicted_cn":"苹果黑腐病","confidence":0.5426,"probs":[0.441844,0.542629,0.001285,0.013077,0.000483,0.000211,0.000471],"truth_class":null,"truth_cn":null},{"id":"0041","source":"test","file":"41.jpg","thumb":"thumbs/test_0041.jpg","predicted_class":"Apple___Black_rot","predicted_cn":"苹果黑腐病","confidence":0.623,"probs":[0.35739,0.62299,0.001356,0.009585,0.007948,0.000445,0.000285],"truth_class":null,"truth_cn":null},{"id":"0065","source":"test","file":"65.jpg","thumb":"thumbs/test_0065.jpg","predicted_class":"Apple___Cedar_apple_rust","predicted_cn":"苹果雪松锈病","confidence":0.7044,"probs":[0.273747,0.000241,0.70441,0.015305,0.000902,0.000327,0.005068],"truth_class":null,"truth_cn":null},{"id":"0259","source":"test","file":"259.jpg","thumb":"thumbs/test_0259.jpg","predicted_class":"Apple___Cedar_apple_rust","predicted_cn":"苹果雪松锈病","confidence":0.999,"probs":[0.000858,5e-06,0.999005,3.6e-05,4e-05,5e-06,5.1e-05],"truth_class":null,"truth_cn":null},{"id":"0107","source":"test","file":"107.jpg","thumb":"thumbs/test_0107.jpg","predicted_class":"Grape___Black_rot","predicted_cn":"葡萄黑腐病","confidence":0.485,"probs":[0.317013,0.035051,0.000491,0.160774,0.485003,0.001123,0.000545],"truth_class":null,"truth_cn":null},{"id":"0639","source":"test","file":"639.jpg","thumb":"thumbs/test_0639.jpg","predicted_class":"Grape___Black_rot","predicted_cn":"葡萄黑腐病","confidence":0.8048,"probs":[0.000367,0.000538,6.7e-05,0.192075,0.804773,0.001863,0.000316],"truth_class":null,"truth_cn":null},{"id":"0884","source":"test","file":"884.jpg","thumb":"thumbs/test_0884.jpg","predicted_class":"Grape___healthy","predicted_cn":"葡萄健康","confidence":0.9998,"probs":[7e-06,5.3e-05,5e-06,4.6e-05,4.1e-05,0.999833,1.5e-05],"truth_class":null,"truth_cn":null},{"id":"0885","source":"test","file":"885.jpg","thumb":"thumbs/test_0885.jpg","predicted_class":"Grape___healthy","predicted_cn":"葡萄健康","confidence":0.9998,"probs":[1.5e-05,2e-05,8e-06,1.7e-05,4.7e-05,0.999814,7.9e-05],"truth_class":null,"truth_cn":null},{"id":"0974","source":"test","file":"974.jpg","thumb":"thumbs/test_0974.jpg","predicted_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","predicted_cn":"葡萄褐斑病","confidence":0.9992,"probs":[3.8e-05,1.3e-05,4.3e-05,2e-05,0.000596,0.000101,0.999189],"truth_class":null,"truth_cn":null},{"id":"0975","source":"test","file":"975.jpg","thumb":"thumbs/test_0975.jpg","predicted_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","predicted_cn":"葡萄褐斑病","confidence":0.9999,"probs":[2.1e-05,7e-06,9e-06,7e-06,6.2e-05,1.3e-05,0.999881],"truth_class":null,"truth_cn":null},{"id":"0001","source":"holdout","file":"0 (1).JPG","thumb":"thumbs/holdout_0001.jpg","predicted_class":"Apple___Apple_scab","predicted_cn":"苹果黑星病","confidence":0.8088,"probs":[0.808811,5.1e-05,0.189148,3.8e-05,0.000185,0.0016,0.000167],"truth_class":"Apple___Apple_scab","truth_cn":"苹果黑星病"},{"id":"0002","source":"holdout","file":"0 (100).JPG","thumb":"thumbs/holdout_0002.jpg","predicted_class":"Apple___Apple_scab","predicted_cn":"苹果黑星病","confidence":0.9962,"probs":[0.996197,0.000371,0.001456,0.000344,1.9e-05,0.000716,0.000897],"truth_class":"Apple___Apple_scab","truth_cn":"苹果黑星病"},{"id":"0019","source":"holdout","file":"0 (239).JPG","thumb":"thumbs/holdout_0019.jpg","predicted_class":"Apple___Black_rot","predicted_cn":"苹果黑腐病","confidence":0.6059,"probs":[0.064774,0.605947,0.000988,0.324277,0.00278,0.001016,0.000218],"truth_class":"Apple___Apple_scab","truth_cn":"苹果黑星病"},{"id":"0051","source":"holdout","file":"1 (1).bmp","thumb":"thumbs/holdout_0051.jpg","predicted_class":"Apple___Black_rot","predicted_cn":"苹果黑腐病","confidence":0.9997,"probs":[5.8e-05,0.99967,1.3e-05,2e-05,0.000126,0.000112,2e-06],"truth_class":"Apple___Black_rot","truth_cn":"苹果黑腐病"},{"id":"0101","source":"holdout","file":"2 (107).JPG","thumb":"thumbs/holdout_0101.jpg","predicted_class":"Apple___Cedar_apple_rust","predicted_cn":"苹果雪松锈病","confidence":0.9996,"probs":[2.8e-05,2e-06,0.999639,2.2e-05,3.3e-05,3.1e-05,0.000245],"truth_class":"Apple___Cedar_apple_rust","truth_cn":"苹果雪松锈病"},{"id":"0102","source":"holdout","file":"2 (112).JPG","thumb":"thumbs/holdout_0102.jpg","predicted_class":"Apple___Cedar_apple_rust","predicted_cn":"苹果雪松锈病","confidence":0.9996,"probs":[9e-06,1.1e-05,0.999604,1.4e-05,0.000313,4e-06,4.5e-05],"truth_class":"Apple___Cedar_apple_rust","truth_cn":"苹果雪松锈病"},{"id":"0123","source":"holdout","file":"3 (1019).JPG","thumb":"thumbs/holdout_0123.jpg","predicted_class":"Apple___healthy","predicted_cn":"苹果健康","confidence":0.9998,"probs":[4.1e-05,5.5e-05,1.4e-05,0.999839,2.8e-05,6e-06,1.7e-05],"truth_class":"Apple___healthy","truth_cn":"苹果健康"},{"id":"0124","source":"holdout","file":"3 (1027).JPG","thumb":"thumbs/holdout_0124.jpg","predicted_class":"Apple___healthy","predicted_cn":"苹果健康","confidence":0.9994,"probs":[8.1e-05,5.1e-05,8.7e-05,0.999392,0.000245,2.2e-05,0.000122],"truth_class":"Apple___healthy","truth_cn":"苹果健康"},{"id":"0255","source":"holdout","file":"4 (12).JPG","thumb":"thumbs/holdout_0255.jpg","predicted_class":"Grape___Black_rot","predicted_cn":"葡萄黑腐病","confidence":0.9998,"probs":[1.1e-05,8e-06,1.7e-05,1.3e-05,0.999805,7e-06,0.000139],"truth_class":"Grape___Black_rot","truth_cn":"葡萄黑腐病"},{"id":"0256","source":"holdout","file":"4 (126).JPG","thumb":"thumbs/holdout_0256.jpg","predicted_class":"Grape___Black_rot","predicted_cn":"葡萄黑腐病","confidence":1.0,"probs":[3e-06,9e-06,3e-06,6e-06,0.999964,7e-06,7e-06],"truth_class":"Grape___Black_rot","truth_cn":"葡萄黑腐病"},{"id":"0349","source":"holdout","file":"5 (103).JPG","thumb":"thumbs/holdout_0349.jpg","predicted_class":"Grape___healthy","predicted_cn":"葡萄健康","confidence":0.9997,"probs":[3.5e-05,0.000139,3.4e-05,3.1e-05,6.8e-05,0.999669,2.6e-05],"truth_class":"Grape___healthy","truth_cn":"葡萄健康"},{"id":"0350","source":"holdout","file":"5 (107).JPG","thumb":"thumbs/holdout_0350.jpg","predicted_class":"Grape___healthy","predicted_cn":"葡萄健康","confidence":0.9997,"probs":[2.5e-05,5.1e-05,4e-06,7e-06,1.3e-05,0.999656,0.000243],"truth_class":"Grape___healthy","truth_cn":"葡萄健康"},{"id":"0383","source":"holdout","file":"6 (12).JPG","thumb":"thumbs/holdout_0383.jpg","predicted_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","predicted_cn":"葡萄褐斑病","confidence":0.9986,"probs":[0.000205,1.7e-05,0.000289,0.000226,0.000284,0.000355,0.998623],"truth_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","truth_cn":"葡萄褐斑病"},{"id":"0384","source":"holdout","file":"6 (126).JPG","thumb":"thumbs/holdout_0384.jpg","predicted_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","predicted_cn":"葡萄褐斑病","confidence":0.99,"probs":[0.003578,0.000237,0.000767,0.003426,0.001506,0.000506,0.989981],"truth_class":"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","truth_cn":"葡萄褐斑病"},{"id":"0003","source":"test","file":"3.jpg","thumb":"thumbs/test_0003.jpg","predicted_class":"Apple___Apple_scab","predicted_cn":"苹果黑星病","confidence":0.9887,"probs":[0.988668,6.1e-05,0.008774,0.000377,0.001061,0.00035,0.00071],"truth_class":null,"truth_cn":null}];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var state = { source: 'all', cls: 'all', wrong: false, q: '', shown: 0, list: [] };
  var content = DEFAULT_CONTENT;
  var stats = FALLBACK_STATS;
  var items = FALLBACK_ITEMS;
  var classOrder = DEFAULT_CONTENT.classes.map(function (c) { return c.key; });
  var manifestCn = {};
  var usingFallbackData = false;
  var contentFallback = false;
  var chunk = window.matchMedia('(min-width: 700px)').matches ? 24 : 12;

  window.__sitePerf = {};

  function get(obj, path) {
    return path.split('.').reduce(function (cur, key) {
      return cur == null ? undefined : cur[key];
    }, obj);
  }

  function fillTemplate(tpl, values) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] == null ? m : values[key];
    });
  }

  function loadJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /* ---------- 文案注入 ---------- */

  function applyContent() {
    var meta = content.meta || {};
    if (meta.title) document.title = meta.title;
    if (meta.description) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', meta.description);
    }
    $$('[data-text]').forEach(function (el) {
      var value = get(content, el.getAttribute('data-text'));
      if (typeof value === 'string') el.textContent = value;
    });
    $$('[data-placeholder]').forEach(function (el) {
      var value = get(content, el.getAttribute('data-placeholder'));
      if (typeof value === 'string') el.setAttribute('placeholder', value);
    });
    $$('[data-aria]').forEach(function (el) {
      var value = get(content, el.getAttribute('data-aria'));
      if (typeof value === 'string') el.setAttribute('aria-label', value);
    });
    var list = $('#boundary-list');
    list.innerHTML = '';
    (get(content, 'footer.boundary') || []).forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function classCn(key) {
    for (var i = 0; i < (content.classes || []).length; i++) {
      if (content.classes[i].key === key) return content.classes[i].cn;
    }
    return manifestCn[key] || key;
  }

  function classMeta(key) {
    var list = content.classes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i];
    }
    return { key: key, cn: manifestCn[key] || key, latin: '', host: '' };
  }

  function countBy(predicate) {
    return items.reduce(function (n, it) { return n + (predicate(it) ? 1 : 0); }, 0);
  }

  function renderMetrics() {
    var val = get(content, 'metrics.val') || {};
    setMetric('val', val.value, val.unit, val.detail);

    var ho = stats.holdout || {};
    var hoCfg = get(content, 'metrics.holdout') || {};
    var hoDetail = fillTemplate(hoCfg.detailTpl, {
      n: ho.n != null ? ho.n : '—',
      wrong: ho.inconsistent != null ? ho.inconsistent : '—'
    });
    setMetric('holdout', ho.acc_pct != null ? ho.acc_pct : hoCfg.value, hoCfg.unit, hoDetail);

    var te = stats.test || {};
    var total = (te.n || 0) + (ho.n || 0) || items.length;
    var snapCfg = get(content, 'metrics.snapshot') || {};
    var snapDetail = fillTemplate(snapCfg.detailTpl, {
      test: te.n != null ? te.n : '—',
      holdout: ho.n != null ? ho.n : '—'
    });
    setMetric('snapshot', total, snapCfg.unit, snapDetail);
  }

  function setMetric(id, value, unit, detail) {
    var v = $('#m-' + id);
    var u = $('#m-' + id + '-unit');
    var d = $('#m-' + id + '-detail');
    if (v) v.textContent = value == null ? '—' : String(value);
    if (u) u.textContent = unit || '';
    if (d) d.textContent = detail || '';
  }

  /* ---------- 筛选控件 ---------- */

  function renderClassChips() {
    var wrap = $('#class-chips');
    wrap.innerHTML = '';
    var allCount = items.length;
    wrap.appendChild(makeChip('all', get(content, 'filters.classAll'), '', allCount));
    (content.classes || []).forEach(function (cls) {
      wrap.appendChild(makeChip(cls.key, cls.cn, cls.latin, countBy(function (it) {
        return it.predicted_class === cls.key;
      })));
    });
  }

  function makeChip(key, cn, latin, count) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.setAttribute('data-cls', key);
    btn.setAttribute('aria-pressed', key === state.cls ? 'true' : 'false');
    if (key === state.cls) btn.classList.add('is-active');

    var name = document.createElement('span');
    name.className = 'chip-name';
    name.textContent = cn;
    btn.appendChild(name);

    if (latin) {
      var sub = document.createElement('span');
      sub.className = 'chip-latin';
      sub.textContent = latin;
      btn.appendChild(sub);
    }

    var num = document.createElement('span');
    num.className = 'chip-count';
    num.textContent = String(count);
    btn.appendChild(num);

    btn.addEventListener('click', function () {
      state.cls = state.cls === key ? 'all' : key;
      applyFilters();
    });
    return btn;
  }

  function renderSourceSeg() {
    var wrap = $('#source-seg');
    wrap.innerHTML = '';
    [
      ['all', get(content, 'filters.sourceAll'), items.length],
      ['test', get(content, 'filters.sourceTest'), countBy(function (it) { return it.source === 'test'; })],
      ['holdout', get(content, 'filters.sourceHoldout'), countBy(function (it) { return it.source === 'holdout'; })]
    ].forEach(function (row) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-btn' + (state.source === row[0] ? ' is-active' : '');
      btn.setAttribute('data-source', row[0]);
      btn.setAttribute('aria-pressed', state.source === row[0] ? 'true' : 'false');
      btn.innerHTML = '<span>' + row[1] + '</span><b>' + row[2] + '</b>';
      btn.addEventListener('click', function () {
        state.source = row[0];
        applyFilters();
      });
      wrap.appendChild(btn);
    });
  }

  function syncControls() {
    $$('#class-chips .chip').forEach(function (btn) {
      var on = btn.getAttribute('data-cls') === state.cls;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('#source-seg .seg-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-source') === state.source;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var wrong = $('#wrong-toggle');
    wrong.classList.toggle('is-active', state.wrong);
    wrong.setAttribute('aria-pressed', state.wrong ? 'true' : 'false');
  }

  /* ---------- 网格与卡片 ---------- */

  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    state.list = items.filter(function (it) {
      if (state.source !== 'all' && it.source !== state.source) return false;
      if (state.cls !== 'all' && it.predicted_class !== state.cls) return false;
      if (state.wrong && !(it.truth_class && it.truth_class !== it.predicted_class)) return false;
      if (q && String(it.file || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    state.shown = 0;
    $('#grid').innerHTML = '';
    $('#empty').hidden = state.list.length > 0;
    syncControls();
    updateCount();
    renderBatch();
  }

  function updateCount() {
    $('#count').textContent = fillTemplate(get(content, 'results.countTpl'), {
      shown: state.shown,
      total: state.list.length
    });
  }

  function renderBatch() {
    if (state.shown >= state.list.length) {
      updateSentinel();
      return;
    }
    var frag = document.createDocumentFragment();
    var end = Math.min(state.list.length, state.shown + chunk);
    for (var i = state.shown; i < end; i++) {
      frag.appendChild(cardFor(state.list[i]));
    }
    $('#grid').appendChild(frag);
    state.shown = end;
    if (!window.__sitePerf.firstCardAt) {
      window.__sitePerf.firstCardAt = performance.now();
    }
    updateCount();
    updateSentinel();
  }

  function updateSentinel() {
    var more = $('#sentinel');
    more.hidden = state.shown >= state.list.length;
  }

  function cardFor(it) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card';
    btn.setAttribute('data-key', it.source + ':' + it.id);
    btn.setAttribute('aria-label', classCn(it.predicted_class) + ' · ' + it.file);

    var media = document.createElement('span');
    media.className = 'card-media';
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 256;
    img.height = 256;
    img.src = './data/' + it.thumb;
    img.alt = classCn(it.predicted_class) + ' · ' + it.file;
    media.appendChild(img);
    btn.appendChild(media);

    var body = document.createElement('span');
    body.className = 'card-body';

    var name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = classCn(it.predicted_class);
    body.appendChild(name);

    var meta = document.createElement('span');
    meta.className = 'card-meta';

    var tag = document.createElement('span');
    tag.className = 'tag src-' + it.source;
    tag.textContent = it.source === 'holdout'
      ? get(content, 'filters.sourceHoldout')
      : get(content, 'filters.sourceTest');
    meta.appendChild(tag);

    if (it.truth_class && it.truth_class !== it.predicted_class) {
      var bad = document.createElement('span');
      bad.className = 'tag bad';
      bad.textContent = get(content, 'card.wrong');
      meta.appendChild(bad);
    }

    var conf = document.createElement('span');
    conf.className = 'card-conf';
    conf.textContent = (it.confidence * 100).toFixed(2) + '%';
    meta.appendChild(conf);
    body.appendChild(meta);

    btn.appendChild(body);
    btn.addEventListener('click', function () { openDetail(it, btn); });
    return btn;
  }

  /* ---------- 样本详情 ---------- */

  var sheet = $('#sheet');
  var sheetReturnFocus = null;

  function openDetail(it, opener) {
    sheetReturnFocus = opener || null;
    var cn = classCn(it.predicted_class);
    $('#sheet-title').textContent = cn;
    $('#sheet-file').textContent = it.file;

    var img = $('#sheet-img');
    img.src = './data/' + it.thumb;
    img.alt = cn + ' · ' + it.file;

    var meta = $('#sheet-meta');
    meta.innerHTML = '';
    meta.appendChild(metaTag(it.source === 'holdout'
      ? get(content, 'filters.sourceHoldout')
      : get(content, 'filters.sourceTest')));
    meta.appendChild(metaTag(get(content, 'detail.conf') + ' ' + (it.confidence * 100).toFixed(2) + '%'));

    var truth = $('#sheet-truth');
    truth.className = 'truth-line';
    if (it.truth_class) {
      var agree = it.truth_class === it.predicted_class;
      truth.textContent = get(content, 'detail.truth') + '：' + classCn(it.truth_class) + ' · ' +
        (agree ? get(content, 'detail.agree') : get(content, 'detail.disagree'));
      if (!agree) {
        truth.textContent += '（预测：' + cn + '）';
        truth.classList.add('is-bad');
      } else {
        truth.classList.add('is-good');
      }
    } else {
      truth.textContent = get(content, 'detail.truthTest');
      truth.classList.add('is-missing');
    }

    var probs = $('#sheet-probs');
    probs.innerHTML = '';
    var order = classOrder.slice();
    order.sort(function (a, b) { return (it.probs[classOrder.indexOf(b)] || 0) - (it.probs[classOrder.indexOf(a)] || 0); });
    order.forEach(function (key, rank) {
      var p = it.probs[classOrder.indexOf(key)] || 0;
      probs.appendChild(probRow(rank, classCn(key), p));
    });

    var top3 = $('#sheet-top3');
    top3.innerHTML = '';
    var title = document.createElement('p');
    title.className = 'top3-title';
    title.textContent = get(content, 'detail.top3');
    top3.appendChild(title);
    var ol = document.createElement('ol');
    ol.className = 'top3-list';
    for (var i = 0; i < Math.min(3, order.length); i++) {
      var li = document.createElement('li');
      var p = it.probs[classOrder.indexOf(order[i])] || 0;
      li.textContent = classCn(order[i]) + ' · ' + (p * 100).toFixed(2) + '%';
      ol.appendChild(li);
    }
    top3.appendChild(ol);

    sheet.hidden = false;
    document.body.classList.add('is-sheet-open');
    $('#sheet-close').focus();
  }

  function metaTag(text) {
    var span = document.createElement('span');
    span.className = 'tag';
    span.textContent = text;
    return span;
  }

  function probRow(rank, cn, prob) {
    var row = document.createElement('div');
    row.className = 'prob-row' + (rank === 0 ? ' is-top' : '');

    var name = document.createElement('span');
    name.className = 'prob-name';
    name.textContent = cn;
    row.appendChild(name);

    var track = document.createElement('span');
    track.className = 'prob-track';
    var bar = document.createElement('span');
    bar.className = 'prob-bar';
    bar.style.width = Math.max(prob * 100, prob > 0 ? 1 : 0) + '%';
    track.appendChild(bar);
    row.appendChild(track);

    var num = document.createElement('span');
    num.className = 'prob-num';
    num.textContent = (prob * 100).toFixed(2) + '%';
    row.appendChild(num);

    return row;
  }

  function closeDetail() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove('is-sheet-open');
    if (sheetReturnFocus && typeof sheetReturnFocus.focus === 'function') sheetReturnFocus.focus();
  }

  /* ---------- 随机抽样 12 张 ---------- */

  function randomSample() {
    if (!items.length) return;
    var pool = items.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    var grid = $('#sample-grid');
    grid.innerHTML = '';
    var take = Math.min(12, pool.length);
    for (var k = 0; k < take; k++) grid.appendChild(cardFor(pool[k]));

    var panel = $('#sample-panel');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#resample').focus();
  }

  /* ---------- 初始化 ---------- */

  function init() {
    applyContent();
    renderMetrics();
    renderClassChips();
    renderSourceSeg();
    syncControls();
    applyFilters();

    var note = $('#offline-note');
    if (usingFallbackData) {
      note.hidden = false;
      note.textContent = get(content, 'offline.dataNote') +
        (contentFallback ? ' ' + get(content, 'offline.contentNote') : '');
    }

    var search = $('#search');
    var timer = null;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = search.value;
        applyFilters();
      }, 160);
    });

    $('#wrong-toggle').addEventListener('click', function () {
      state.wrong = !state.wrong;
      applyFilters();
    });

    $('#reset').addEventListener('click', function () {
      state.source = 'all';
      state.cls = 'all';
      state.wrong = false;
      state.q = '';
      search.value = '';
      applyFilters();
    });

    $('#random').addEventListener('click', randomSample);
    $('#resample').addEventListener('click', randomSample);
    $('#close-sample').addEventListener('click', function () {
      $('#sample-panel').hidden = true;
      $('#random').focus();
    });

    $('#more').addEventListener('click', renderBatch);
    $('#sheet-close').addEventListener('click', closeDetail);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) closeDetail();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDetail();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) renderBatch();
      }, { rootMargin: '600px 0px' });
      io.observe($('#sentinel'));
    }
  }

  var contentReq = loadJSON('./content.json')
    .then(function (data) {
      if (data && data.classes) content = data;
    })
    .catch(function () { contentFallback = true; });

  var statsReq = loadJSON('./data/snapshot_stats.json')
    .then(function (data) { if (data && data.holdout) stats = data; })
    .catch(function () {});

  var manifestReq = loadJSON('./data/manifest.json')
    .then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items.length) throw new Error('manifest 格式异常');
      items = data.items;
      if (Array.isArray(data.class_names) && data.class_names.length === content.classes.length) {
        classOrder = data.class_names;
      }
      if (Array.isArray(data.class_names) && Array.isArray(data.class_names_cn)) {
        data.class_names.forEach(function (key, i) { manifestCn[key] = data.class_names_cn[i]; });
      }
    })
    .catch(function () { usingFallbackData = true; });

  Promise.all([contentReq, statsReq, manifestReq]).then(init, init);
})();

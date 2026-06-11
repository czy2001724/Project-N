// DOM-based menus for the base: vendor, missions and the deploy (dungeon
// select) door. Opening a panel frees the mouse; closing re-locks the game.

const VENDOR_ITEMS = [
  { name: "步枪弹药 ×60", price: 120 },
  { name: "手枪弹药 ×36", price: 80 },
  { name: "医疗包", price: 200 },
  { name: "轻型护甲", price: 450 },
  { name: "步枪改装件", price: 900 },
];

const MISSIONS = [
  { name: "清剿前哨", desc: "在废弃设施消灭 12 个敌人", reward: "₡ 600 + 材料 ×4" },
  { name: "回收数据", desc: "潜入异常区域取回 3 份数据核心", reward: "₡ 850 + 改装件" },
  { name: "猎杀目标", desc: "击杀精英单位「锈蚀者」", reward: "₡ 1200 + 稀有装备" },
];

const DUNGEONS = [
  { name: "废弃设施", diff: "普通", desc: "适合新晋探险者的低危区域。" },
  { name: "异常区域", diff: "危险", desc: "环境不稳定，敌人更强，掉落更好。" },
  { name: "Boss 巢穴", diff: "高危", desc: "强敌据点，仅限装备精良者挑战。" },
];

export function createUI(hooks = {}) {
  const credits = { value: 1500 };

  const root = document.createElement("div");
  root.id = "menuRoot";
  root.className = "hidden";
  document.body.appendChild(root);

  let open = false;

  function close() {
    open = false;
    root.className = "hidden";
    root.innerHTML = "";
    if (hooks.onClose) hooks.onClose();
  }

  function shell(title, sub) {
    root.className = "";
    root.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "menuPanel";
    panel.innerHTML = `
      <div class="menuHead">
        <div>
          <h2>${title}</h2>
          <p>${sub}</p>
        </div>
        <div class="credits">余额 <b>₡ ${credits.value}</b></div>
      </div>
      <div class="menuBody"></div>
      <button class="menuClose">关闭 (Esc)</button>
    `;
    root.appendChild(panel);
    panel.querySelector(".menuClose").addEventListener("click", () => {
      close();
      if (hooks.onResume) hooks.onResume();
    });
    return panel.querySelector(".menuBody");
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 400);
    }, 2200);
  }

  function openVendor() {
    open = true;
    const body = shell("装备商店", "购买弹药、护甲与改装件");
    for (const item of VENDOR_ITEMS) {
      const row = document.createElement("div");
      row.className = "listRow";
      row.innerHTML = `<span class="rowName">${item.name}</span>
        <span class="rowMeta">₡ ${item.price}</span>
        <button class="rowBtn">购买</button>`;
      row.querySelector(".rowBtn").addEventListener("click", () => {
        if (credits.value >= item.price) {
          credits.value -= item.price;
          root.querySelector(".credits b").textContent = `₡ ${credits.value}`;
          toast(`已购买：${item.name}`);
        } else {
          toast("余额不足");
        }
      });
      body.appendChild(row);
    }
  }

  function openMission() {
    open = true;
    const body = shell("任务终端", "接取任务获取奖励");
    for (const m of MISSIONS) {
      const row = document.createElement("div");
      row.className = "listRow tall";
      row.innerHTML = `<div class="rowText"><span class="rowName">${m.name}</span>
        <span class="rowDesc">${m.desc}</span>
        <span class="rowReward">奖励：${m.reward}</span></div>
        <button class="rowBtn">接取</button>`;
      row.querySelector(".rowBtn").addEventListener("click", (e) => {
        e.target.textContent = "已接取";
        e.target.disabled = true;
        toast(`已接取任务：${m.name}`);
      });
      body.appendChild(row);
    }
  }

  function openDeploy() {
    open = true;
    const body = shell("选择副本", "选择部署区域并出击");
    for (const d of DUNGEONS) {
      const row = document.createElement("div");
      row.className = "listRow tall";
      row.innerHTML = `<div class="rowText"><span class="rowName">${d.name}
        <em class="diff diff-${d.diff}">${d.diff}</em></span>
        <span class="rowDesc">${d.desc}</span></div>
        <button class="rowBtn deploy">部署</button>`;
      row.querySelector(".rowBtn").addEventListener("click", () => {
        toast(`正在部署到「${d.name}」…（战斗关卡开发中）`);
        if (hooks.onDeploy) hooks.onDeploy(d);
        close();
        if (hooks.onResume) hooks.onResume();
      });
      body.appendChild(row);
    }
  }

  function openAction(action) {
    if (action === "vendor") openVendor();
    else if (action === "mission") openMission();
    else if (action === "deploy") openDeploy();
  }

  return { openAction, close, toast, isOpen: () => open };
}

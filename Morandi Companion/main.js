const {
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} = require("obsidian");

const CLOCK_VIEW_TYPE = "morandi-clock-view";
const PALETTES = ["sand", "mist", "lilac", "sage"];
const WALLPAPER_ASSETS = Object.freeze({
  orbit: "morandi-orbit.svg",
  horizon: "morandi-horizon.svg",
  archipelago: "morandi-archipelago.png",
  terrace: "morandi-terrace.png",
  garden: "morandi-garden.png",
  clouds: "morandi-clouds.png",
});
const WALLPAPERS = [...Object.keys(WALLPAPER_ASSETS), "none"];
const CLOCK_LOCALES = ["zh-CN", "en-US", "auto"];
const MAX_CLOCK_QUOTE_LENGTH = 240;

const DEFAULT_SETTINGS = {
  palette: "sand",
  wallpaper: "orbit",
  wallpaperOpacity: 0.16,
  floatingLayout: true,
  gridPaper: true,
  folderColors: true,
  decorations: true,
  openClockOnLoad: true,
  clockLocale: "zh-CN",
  clockQuote: "No pain, no gain.",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSettings(data) {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const wallpaperOpacity = typeof source.wallpaperOpacity === "number"
    ? source.wallpaperOpacity
    : Number.NaN;
  const clockQuote = typeof source.clockQuote === "string"
    ? source.clockQuote.trim().slice(0, MAX_CLOCK_QUOTE_LENGTH)
    : DEFAULT_SETTINGS.clockQuote;

  return {
    palette: PALETTES.includes(source.palette) ? source.palette : DEFAULT_SETTINGS.palette,
    wallpaper: WALLPAPERS.includes(source.wallpaper) ? source.wallpaper : DEFAULT_SETTINGS.wallpaper,
    wallpaperOpacity: Number.isFinite(wallpaperOpacity)
      ? clamp(wallpaperOpacity, 0, 0.36)
      : DEFAULT_SETTINGS.wallpaperOpacity,
    floatingLayout: typeof source.floatingLayout === "boolean"
      ? source.floatingLayout
      : DEFAULT_SETTINGS.floatingLayout,
    gridPaper: typeof source.gridPaper === "boolean"
      ? source.gridPaper
      : DEFAULT_SETTINGS.gridPaper,
    folderColors: typeof source.folderColors === "boolean"
      ? source.folderColors
      : DEFAULT_SETTINGS.folderColors,
    decorations: typeof source.decorations === "boolean"
      ? source.decorations
      : DEFAULT_SETTINGS.decorations,
    openClockOnLoad: typeof source.openClockOnLoad === "boolean"
      ? source.openClockOnLoad
      : DEFAULT_SETTINGS.openClockOnLoad,
    clockLocale: CLOCK_LOCALES.includes(source.clockLocale)
      ? source.clockLocale
      : DEFAULT_SETTINGS.clockLocale,
    clockQuote,
  };
}

function createSvgElement(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

class MorandiClockWidget {
  constructor(plugin) {
    this.plugin = plugin;
    this.timer = 0;
    this.rootEl = null;
  }

  mount(host) {
    if (this.rootEl && this.rootEl.parentElement === host) {
      this.updateClock();
      return;
    }

    this.destroy();
    const root = host.createDiv({ cls: "morandi-clock-dock" });
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", "莫兰迪时钟");
    this.rootEl = root;

    const card = root.createDiv({ cls: "morandi-clock-card" });
    const face = card.createDiv({ cls: "morandi-clock-face" });
    const svg = createSvgElement("svg", {
      class: "morandi-clock-svg",
      viewBox: "0 0 100 100",
      role: "img",
      "aria-label": "模拟时钟",
    });
    face.appendChild(svg);

    svg.appendChild(createSvgElement("circle", {
      class: "morandi-clock-ring",
      cx: 50,
      cy: 50,
      r: 47,
    }));

    const ticks = createSvgElement("g", { class: "morandi-clock-ticks" });
    for (let index = 0; index < 60; index += 1) {
      const major = index % 5 === 0;
      ticks.appendChild(createSvgElement("line", {
        x1: 50,
        y1: major ? 8 : 6,
        x2: 50,
        y2: major ? 13 : 9,
        transform: `rotate(${index * 6} 50 50)`,
        class: major ? "is-major" : "is-minor",
      }));
    }
    svg.appendChild(ticks);

    const numerals = [12, 3, 6, 9];
    const positions = [[50, 19], [81, 53], [50, 87], [19, 53]];
    numerals.forEach((value, index) => {
      const label = createSvgElement("text", {
        x: positions[index][0],
        y: positions[index][1],
        class: "morandi-clock-number",
        "text-anchor": "middle",
      });
      label.textContent = String(value);
      svg.appendChild(label);
    });

    this.hourHand = createSvgElement("line", {
      class: "morandi-clock-hand is-hour",
      x1: 50,
      y1: 52,
      x2: 50,
      y2: 29,
    });
    this.minuteHand = createSvgElement("line", {
      class: "morandi-clock-hand is-minute",
      x1: 50,
      y1: 54,
      x2: 50,
      y2: 20,
    });
    this.secondHand = createSvgElement("line", {
      class: "morandi-clock-hand is-second",
      x1: 50,
      y1: 57,
      x2: 50,
      y2: 17,
    });
    svg.appendChild(this.hourHand);
    svg.appendChild(this.minuteHand);
    svg.appendChild(this.secondHand);
    svg.appendChild(createSvgElement("circle", {
      class: "morandi-clock-pin",
      cx: 50,
      cy: 50,
      r: 2.4,
    }));

    this.dateEl = card.createDiv({ cls: "morandi-clock-date" });
    this.timeEl = card.createDiv({ cls: "morandi-clock-time" });
    this.quoteEl = card.createDiv({ cls: "morandi-clock-quote" });

    this.updateClock();
    this.timer = window.setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    if (!this.hourHand || !this.minuteHand || !this.secondHand) return;

    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    this.hourHand.setAttribute("transform", `rotate(${hours * 30} 50 50)`);
    this.minuteHand.setAttribute("transform", `rotate(${minutes * 6} 50 50)`);
    this.secondHand.setAttribute("transform", `rotate(${seconds * 6} 50 50)`);

    const clockLocale = CLOCK_LOCALES.includes(this.plugin.settings.clockLocale)
      ? this.plugin.settings.clockLocale
      : DEFAULT_SETTINGS.clockLocale;
    const locale = clockLocale === "auto"
      ? undefined
      : clockLocale;
    this.dateEl.setText(new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now));
    this.timeEl.setText(new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now));
    const quote = typeof this.plugin.settings.clockQuote === "string"
      ? this.plugin.settings.clockQuote
      : DEFAULT_SETTINGS.clockQuote;
    this.quoteEl.setText(quote || " ");
  }

  destroy() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
    if (this.rootEl) this.rootEl.remove();
    this.rootEl = null;
  }
}

class MorandiCompanionSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Morandi Companion" });
    containerEl.createEl("p", {
      text: "这些选项控制 Morandi Calm 的配色、背景和左侧时钟。主题本身仍可独立使用。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("莫兰迪配色")
      .setDesc("浅色与深色会自动使用同一组配套色板。")
      .addDropdown((dropdown) => dropdown
        .addOption("sand", "奶油砂岩")
        .addOption("mist", "雾蓝石板")
        .addOption("lilac", "灰粉丁香")
        .addOption("sage", "鼠尾草绿")
        .setValue(this.plugin.settings.palette)
        .onChange(async (value) => {
          this.plugin.settings.palette = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("环境背景")
      .addDropdown((dropdown) => dropdown
        .addOption("orbit", "几何轨道")
        .addOption("horizon", "寂静地平线")
        .addOption("archipelago", "雾海群岛")
        .addOption("terrace", "静谧阶台")
        .addOption("garden", "庭院枝影")
        .addOption("clouds", "纸上云境")
        .addOption("none", "纯色")
        .setValue(this.plugin.settings.wallpaper)
        .onChange(async (value) => {
          this.plugin.settings.wallpaper = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("背景图透明度")
      .setDesc("降低数值可以让正文区域更加安静。")
      .addSlider((slider) => slider
        .setLimits(0, 0.36, 0.01)
        .setDynamicTooltip()
        .setValue(this.plugin.settings.wallpaperOpacity)
        .onChange(async (value) => {
          this.plugin.settings.wallpaperOpacity = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("悬浮编辑器")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.floatingLayout)
        .onChange(async (value) => {
          this.plugin.settings.floatingLayout = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("网格纸纹理")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.gridPaper)
        .onChange(async (value) => {
          this.plugin.settings.gridPaper = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("文件夹彩色标记")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.folderColors)
        .onChange(async (value) => {
          this.plugin.settings.folderColors = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("背景装饰")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.decorations)
        .onChange(async (value) => {
          this.plugin.settings.decorations = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("在文件列表底部显示时钟")
      .setDesc("固定在左侧文件树下方，不会替换文件列表。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openClockOnLoad)
        .onChange(async (value) => {
          this.plugin.settings.openClockOnLoad = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("时钟日期语言")
      .addDropdown((dropdown) => dropdown
        .addOption("zh-CN", "简体中文")
        .addOption("en-US", "English")
        .addOption("auto", "跟随系统")
        .setValue(this.plugin.settings.clockLocale)
        .onChange(async (value) => {
          this.plugin.settings.clockLocale = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("时钟格言")
      .addText((text) => text
        .setPlaceholder("No pain, no gain.")
        .setValue(this.plugin.settings.clockQuote)
        .onChange(async (value) => {
          this.plugin.settings.clockQuote = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = class MorandiCompanionPlugin extends Plugin {
  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    this.clockWidget = new MorandiClockWidget(this);
    this.activeFileRefreshFrame = 0;
    this.activeFileSettleTimer = 0;
    this.mobileDrawerWorkAreaTimer = 0;
    this.mobileDrawerWorkAreaStyles = new Map();
    this.fileExplorerObserver = null;
    this.observedFileExplorerHost = null;
    this.fileExplorerInteractionHost = null;
    this.fileExplorerPointerHandler = (event) => this.handleFileExplorerPointer(event);
    this.currentFilePath = this.app.workspace.getActiveFile()?.path ?? null;
    this.applyThemeClasses();
    this.addRibbonIcon("clock-3", "显示或隐藏莫兰迪时钟", async () => {
      await this.toggleClock();
    });

    this.addCommand({
      id: "toggle-morandi-clock",
      name: "显示或隐藏文件列表底部的莫兰迪时钟",
      callback: async () => this.toggleClock(),
    });

    this.addCommand({
      id: "cycle-morandi-palette",
      name: "切换下一套莫兰迪配色",
      callback: async () => {
        const currentIndex = PALETTES.indexOf(this.settings.palette);
        this.settings.palette = PALETTES[(currentIndex + 1) % PALETTES.length];
        await this.saveSettings();
        new Notice(`莫兰迪配色：${this.settings.palette}`);
      },
    });

    this.addSettingTab(new MorandiCompanionSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      this.detachLegacyClockLeaves();
      this.syncClock();
      this.observeFileExplorer();
      this.currentFilePath = this.app.workspace.getActiveFile()?.path ?? this.currentFilePath;
      this.scheduleCurrentFileMarker();
      this.scheduleSettledCurrentFileMarker();
      this.scheduleMobileDrawerWorkAreaNormalization();
    });

    this.detachLegacyClockLeaves();
    const initialSyncTimer = window.setTimeout(() => {
      this.detachLegacyClockLeaves();
      this.syncClock();
      this.observeFileExplorer();
      this.currentFilePath = this.app.workspace.getActiveFile()?.path ?? this.currentFilePath;
      this.scheduleCurrentFileMarker();
      this.scheduleSettledCurrentFileMarker();
      this.scheduleMobileDrawerWorkAreaNormalization();
    }, 400);
    this.register(() => window.clearTimeout(initialSyncTimer));

    this.registerEvent(this.app.workspace.on("layout-change", () => {
      if (this.settings.openClockOnLoad) this.syncClock();
      this.observeFileExplorer();
      this.scheduleCurrentFileMarker();
      this.scheduleSettledCurrentFileMarker();
      this.scheduleMobileDrawerWorkAreaNormalization();
    }));

    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      this.scheduleCurrentFileMarker(file?.path ?? null);
      this.scheduleSettledCurrentFileMarker();
    }));
  }

  onunload() {
    if (this.activeFileRefreshFrame) {
      window.cancelAnimationFrame(this.activeFileRefreshFrame);
      this.activeFileRefreshFrame = 0;
    }
    if (this.activeFileSettleTimer) {
      window.clearTimeout(this.activeFileSettleTimer);
      this.activeFileSettleTimer = 0;
    }
    if (this.mobileDrawerWorkAreaTimer) {
      window.clearTimeout(this.mobileDrawerWorkAreaTimer);
      this.mobileDrawerWorkAreaTimer = 0;
    }
    if (this.fileExplorerObserver) this.fileExplorerObserver.disconnect();
    if (this.fileExplorerInteractionHost) {
      this.fileExplorerInteractionHost.removeEventListener(
        "pointerdown",
        this.fileExplorerPointerHandler,
        true,
      );
    }
    document.querySelectorAll(".morandi-current-file").forEach((element) => {
      element.classList.remove("morandi-current-file");
    });
    this.restoreMobileDrawerWorkAreas();
    if (this.clockWidget) this.clockWidget.destroy();
    this.removeThemeClasses();
  }

  async saveSettings() {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    this.applyThemeClasses();
    this.syncClock();
  }

  removeThemeClasses() {
    PALETTES.forEach((value) => document.body.classList.remove(`morandi-palette-${value}`));
    WALLPAPERS.forEach((value) => document.body.classList.remove(`morandi-wallpaper-${value}`));
    [
      "morandi-flat-layout",
      "morandi-grid-paper-off",
      "morandi-folder-colors-off",
      "morandi-decorations-off",
      "morandi-clock-visible",
    ].forEach((value) => document.body.classList.remove(value));
    document.body.style.removeProperty("--mc-wallpaper-opacity");
    document.body.style.removeProperty("--mc-wallpaper-image");
  }

  applyThemeClasses() {
    this.removeThemeClasses();
    const palette = PALETTES.includes(this.settings.palette) ? this.settings.palette : "sand";
    const wallpaper = WALLPAPERS.includes(this.settings.wallpaper) ? this.settings.wallpaper : "orbit";
    document.body.classList.add(`morandi-palette-${palette}`);
    document.body.classList.add(`morandi-wallpaper-${wallpaper}`);
    document.body.classList.toggle("morandi-flat-layout", !this.settings.floatingLayout);
    document.body.classList.toggle("morandi-grid-paper-off", !this.settings.gridPaper);
    document.body.classList.toggle("morandi-folder-colors-off", !this.settings.folderColors);
    document.body.classList.toggle("morandi-decorations-off", !this.settings.decorations);
    document.body.style.setProperty("--mc-wallpaper-opacity", String(this.settings.wallpaperOpacity));
    const assetName = WALLPAPER_ASSETS[wallpaper];
    if (assetName) {
      const pluginDir = this.manifest.dir
        || `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
      const assetPath = `${pluginDir}/assets/${assetName}`;
      const resourcePath = this.app.vault.adapter.getResourcePath(assetPath);
      document.body.style.setProperty(
        "--mc-wallpaper-image",
        `url("${resourcePath.replace(/["\\]/g, "\\$&")}")`,
      );
    }
    this.scheduleMobileDrawerWorkAreaNormalization();
  }

  scheduleMobileDrawerWorkAreaNormalization() {
    if (!document.body.classList.contains("is-mobile")) return;
    if (this.mobileDrawerWorkAreaTimer) window.clearTimeout(this.mobileDrawerWorkAreaTimer);
    this.mobileDrawerWorkAreaTimer = window.setTimeout(() => {
      this.mobileDrawerWorkAreaTimer = 0;
      this.normalizeMobileDrawerWorkAreas();
    }, 120);
  }

  normalizeMobileDrawerWorkAreas() {
    if (!document.body.classList.contains("is-mobile")) return;
    const workAreaSelector = [
      ".workspace-drawer .workspace-leaf",
      ".workspace-drawer .workspace-leaf-content",
      ".workspace-drawer .workspace-leaf-content .view-content",
      ".workspace-drawer .workspace-leaf-content[data-type=\"outline\"]",
      ".workspace-drawer .workspace-leaf-content[data-type=\"backlink\"]",
      ".workspace-drawer .workspace-leaf-content[data-type=\"backlinks\"]",
    ].join(", ");

    document.querySelectorAll(workAreaSelector).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.closest(".workspace-drawer-vault-profile")) return;

      if (!this.mobileDrawerWorkAreaStyles.has(element)) {
        this.mobileDrawerWorkAreaStyles.set(element, [
          ["background", element.style.getPropertyValue("background"), element.style.getPropertyPriority("background")],
          ["background-image", element.style.getPropertyValue("background-image"), element.style.getPropertyPriority("background-image")],
          ["box-shadow", element.style.getPropertyValue("box-shadow"), element.style.getPropertyPriority("box-shadow")],
          ["backdrop-filter", element.style.getPropertyValue("backdrop-filter"), element.style.getPropertyPriority("backdrop-filter")],
          ["-webkit-backdrop-filter", element.style.getPropertyValue("-webkit-backdrop-filter"), element.style.getPropertyPriority("-webkit-backdrop-filter")],
        ]);
      }
      element.classList.add("morandi-mobile-transparent-work-area");
      element.style.setProperty("background", "transparent", "important");
      element.style.setProperty("background-image", "none", "important");
      element.style.setProperty("box-shadow", "none", "important");
      element.style.setProperty("backdrop-filter", "none", "important");
      element.style.setProperty("-webkit-backdrop-filter", "none", "important");
    });
  }

  restoreMobileDrawerWorkAreas() {
    this.mobileDrawerWorkAreaStyles.forEach((properties, element) => {
      if (!element.isConnected) return;
      properties.forEach(([property, value, priority]) => {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      });
      element.classList.remove("morandi-mobile-transparent-work-area");
    });
    this.mobileDrawerWorkAreaStyles.clear();
  }

  detachLegacyClockLeaves() {
    const legacyLeaves = new Set(this.app.workspace.getLeavesOfType(CLOCK_VIEW_TYPE));
    this.app.workspace.iterateAllLeaves((leaf) => {
      const stateType = leaf.getViewState && leaf.getViewState().type;
      const viewType = leaf.view && leaf.view.getViewType && leaf.view.getViewType();
      if (stateType === CLOCK_VIEW_TYPE || viewType === CLOCK_VIEW_TYPE) legacyLeaves.add(leaf);
    });
    legacyLeaves.forEach((leaf) => leaf.detach());
  }

  getFileExplorerHost() {
    const leaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
    if (!leaf || !leaf.view || !leaf.view.containerEl) return null;
    return leaf.view.containerEl.querySelector(".nav-files-container");
  }

  scheduleCurrentFileMarker(activePath) {
    if (activePath !== undefined) this.currentFilePath = activePath;
    if (this.activeFileRefreshFrame) return;
    this.activeFileRefreshFrame = window.requestAnimationFrame(() => {
      this.activeFileRefreshFrame = 0;
      this.syncCurrentFileMarker(this.currentFilePath);
    });
  }

  scheduleSettledCurrentFileMarker() {
    if (this.activeFileSettleTimer) window.clearTimeout(this.activeFileSettleTimer);
    this.activeFileSettleTimer = window.setTimeout(() => {
      this.activeFileSettleTimer = 0;
      this.scheduleCurrentFileMarker(this.app.workspace.getActiveFile()?.path ?? null);
    }, 120);
  }

  syncCurrentFileMarker(activePath = this.currentFilePath) {
    const fileTitles = document.querySelectorAll(
      ".workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path]",
    );
    fileTitles.forEach((title) => title.classList.remove("morandi-current-file"));
    if (!activePath) return;
    fileTitles.forEach((title) => {
      if (title.getAttribute("data-path") === activePath) {
        title.classList.add("morandi-current-file");
      }
    });
  }

  handleFileExplorerPointer(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const fileTitle = target?.closest(".nav-file-title[data-path]");
    const filePath = fileTitle?.getAttribute("data-path");
    if (filePath) this.scheduleCurrentFileMarker(filePath);
  }

  bindFileExplorerInteraction(host) {
    if (host === this.fileExplorerInteractionHost) return;
    if (this.fileExplorerInteractionHost) {
      this.fileExplorerInteractionHost.removeEventListener(
        "pointerdown",
        this.fileExplorerPointerHandler,
        true,
      );
    }
    this.fileExplorerInteractionHost = host;
    if (host) host.addEventListener("pointerdown", this.fileExplorerPointerHandler, true);
  }

  observeFileExplorer() {
    const host = this.getFileExplorerHost();
    if (host === this.observedFileExplorerHost) return;

    if (this.fileExplorerObserver) this.fileExplorerObserver.disconnect();
    this.fileExplorerObserver = null;
    this.observedFileExplorerHost = host;
    this.bindFileExplorerInteraction(host);

    if (!host) return;

    this.fileExplorerObserver = new MutationObserver((mutations) => {
      const changedFileTree = mutations.some((mutation) => {
        const target = mutation.target;
        return !(target instanceof Element) || !target.closest(".morandi-clock-dock");
      });
      if (changedFileTree) this.scheduleCurrentFileMarker();
    });
    this.fileExplorerObserver.observe(host, { childList: true, subtree: true });
  }

  syncClock() {
    if (!this.clockWidget) return;
    if (!this.settings.openClockOnLoad) {
      document.body.classList.remove("morandi-clock-visible");
      this.clockWidget.destroy();
      return;
    }

    const host = this.getFileExplorerHost();
    if (!host) {
      document.body.classList.remove("morandi-clock-visible");
      this.clockWidget.destroy();
      return;
    }

    document.body.classList.add("morandi-clock-visible");
    this.clockWidget.mount(host);
  }

  async toggleClock() {
    this.settings.openClockOnLoad = !this.settings.openClockOnLoad;
    await this.saveSettings();
    new Notice(this.settings.openClockOnLoad ? "莫兰迪时钟已显示" : "莫兰迪时钟已隐藏");
  }
};

// src/module/helpers/ui-helpers.ts

/**
 * Register custom Handlebars helpers for UI enhancements
 */
export function registerHandlebarsHelpers(): void {
  // Equal comparison helper
  Handlebars.registerHelper('eq', function(arg1, arg2) {
    return arg1 === arg2;
  });

  // Not equal comparison helper
  Handlebars.registerHelper('neq', function(arg1, arg2) {
    return arg1 !== arg2;
  });

  // Greater than helper
  Handlebars.registerHelper('gt', function(arg1, arg2) {
    return arg1 > arg2;
  });

  // Less than helper
  Handlebars.registerHelper('lt', function(arg1, arg2) {
    return arg1 < arg2;
  });

  // Concatenate strings
  Handlebars.registerHelper('concat', function() {
    let outStr = '';
    for (let arg in arguments) {
      if (typeof arguments[arg] !== 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function(str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Format number with sign
  Handlebars.registerHelper('formatMod', function(num) {
    if (isNaN(num)) return '';
    return num >= 0 ? `+${num}` : `${num}`;
  });

  // Truncate text helper
  Handlebars.registerHelper('truncate', function(text, length) {
    if (typeof text !== 'string') return '';
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  });

  // Conditional class helper
  Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
    switch (operator) {
      case '==':
        return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
        return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
        return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
        return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
        return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
        return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
        return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
        return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&':
        return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||':
        return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });

  // Get progress percent helper (for XP and other progress bars)
  Handlebars.registerHelper('progressPercent', function(current, max) {
    if (isNaN(current) || isNaN(max) || max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  });

  // Get CSS class for wound severity
  Handlebars.registerHelper('woundSeverityClass', function(severity) {
    if (severity <= 3) return 'wound-minor';
    if (severity <= 7) return 'wound-moderate';
    if (severity <= 10) return 'wound-severe';
    return 'wound-deadly';
  });

  // Get item quality class based on condition
  Handlebars.registerHelper('itemQualityClass', function(condition) {
    if (condition === 0) return 'quality-good';
    if (condition === 1) return 'quality-damaged';
    return 'quality-broken';
  });
}

/**
 * Setup global UI improvements
 */
export function setupUIImprovements(): void {
  // Add global tooltips functionality
  document.body.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.tooltip) {
      // Position and show tooltip logic could be implemented here
      // For now we're using CSS-based tooltips
    }
  });

  // Add a character sheet themes menu to settings
  game.settings.register("glog2d6", "sheetTheme", {
    name: "SETTINGS.SheetThemeName",
    hint: "SETTINGS.SheetThemeHint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "default": "SETTINGS.ThemeDefault",
      "dark": "SETTINGS.ThemeDark",
      "parchment": "SETTINGS.ThemeParchment",
      "retro": "SETTINGS.ThemeRetro"
    },
    default: "default",
    onChange: () => {
      // Refresh all open character sheets
      Object.values(ui.windows).forEach(app => {
        if (app instanceof ActorSheet) {
          app.render(true);
        }
      });
    }
  });

  // Apply current theme class to sheets when rendered
  Hooks.on("renderActorSheet", (app, html, data) => {
    const theme = game.settings.get("glog2d6", "sheetTheme");
    html.removeClass("theme-default theme-dark theme-parchment theme-retro");
    html.addClass(`theme-${theme}`);
  });
}

/**
 * Create a progress bar with custom styling
 */
export function createProgressBar(current: number, max: number, options: {
  cssClass?: string,
  labelText?: string,
  showLabel?: boolean,
  showValues?: boolean
} = {}): HTMLElement {
  const percent = Math.min(100, Math.round((current / max) * 100));

  // Create container
  const container = document.createElement('div');
  container.className = `progress-bar ${options.cssClass || ''}`;

  // Create bar
  const bar = document.createElement('div');
  bar.className = 'progress-bar-fill';
  bar.style.width = `${percent}%`;

  // Add label if requested
  if (options.showLabel && options.labelText) {
    const label = document.createElement('div');
    label.className = 'progress-bar-label';
    label.textContent = options.labelText;
    container.appendChild(label);
  }

  // Add values if requested
  if (options.showValues) {
    const values = document.createElement('div');
    values.className = 'progress-bar-values';
    values.textContent = `${current}/${max}`;
    container.appendChild(values);
  }

  // Add bar to container
  container.appendChild(bar);

  return container;
}

/**
 * Display confirmation dialog with improved styling
 */
export function confirmDialog(options: {
  title: string,
  content: string,
  yes?: () => void,
  no?: () => void,
  defaultButton?: string
}): void {
  const dialog = new Dialog({
    title: options.title,
    content: `<div class="glog2d6-dialog">${options.content}</div>`,
    buttons: {
      yes: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize("GLOG.Yes"),
        callback: options.yes
      },
      no: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("GLOG.No"),
        callback: options.no
      }
    },
    default: options.defaultButton || "no"
  });

  dialog.render(true);
}

/**
 * Create an attractive notification message
 */
export function notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const notification = document.createElement('div');
  notification.className = `glog2d6-notification notification-${type}`;

  // Add icon based on type
  let icon = '';
  switch (type) {
    case 'info':
      icon = 'info-circle';
      break;
    case 'success':
      icon = 'check-circle';
      break;
    case 'warning':
      icon = 'exclamation-triangle';
      break;
    case 'error':
      icon = 'times-circle';
      break;
  }

  notification.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span class="notification-message">${message}</span>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('notification-hide');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

/**
 * Create tabbed interface (for use in custom dialogs)
 */
export function createTabbedContent(tabs: {id: string, label: string, content: string}[]): string {
  const tabsHtml = tabs.map(tab =>
    `<a class="tab" data-tab="${tab.id}">${tab.label}</a>`
  ).join('');

  const contentHtml = tabs.map(tab =>
    `<div class="tab-content" data-tab="${tab.id}">${tab.content}</div>`
  ).join('');

  return `
    <div class="glog2d6-tabs">
      <nav class="tabs">${tabsHtml}</nav>
      <div class="tab-contents">${contentHtml}</div>
    </div>
  `;
}

// Add CSS for these helpers
Hooks.once('init', () => {
  const style = document.createElement('style');
  style.id = 'glog2d6-ui-helpers-style';
  style.textContent = `
    /* Progress Bar Styles */
    .progress-bar {
      position: relative;
      height: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      overflow: hidden;
      margin: 4px 0;
    }

    .progress-bar-fill {
      height: 100%;
      background: var(--color-accent);
      transition: width 0.3s;
    }

    .progress-bar-label {
      position: absolute;
      top: -15px;
      left: 0;
      font-size: 10px;
    }

    .progress-bar-values {
      position: absolute;
      top: -15px;
      right: 0;
      font-size: 10px;
    }

    /* Notification Styles */
    .glog2d6-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-background);
      border-left: 4px solid var(--color-accent);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      padding: 10px 15px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 4px;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    }

    .notification-info {
      border-left-color: var(--color-info);
    }

    .notification-success {
      border-left-color: var(--color-success);
    }

    .notification-warning {
      border-left-color: var(--color-warning);
    }

    .notification-error {
      border-left-color: var(--color-danger);
    }

    .notification-hide {
      animation: slideOut 0.3s ease-in forwards;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }

    /* Dialog Styles */
    .glog2d6-dialog {
      padding: 10px;
      line-height: 1.5;
    }

    /* Tabbed content */
    .glog2d6-tabs .tabs {
      display: flex;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 10px;
    }

    .glog2d6-tabs .tab {
      padding: 5px 10px;
      cursor: pointer;
    }

    .glog2d6-tabs .tab.active {
      color: var(--color-accent);
      border-bottom: 2px solid var(--color-accent);
    }

    .glog2d6-tabs .tab-content {
      display: none;
    }

    .glog2d6-tabs .tab-content.active {
      display: block;
    }
  `;

  document.head.appendChild(style);
});

// Initialize tabs
Hooks.on('renderApplication', (app, html, data) => {
  const tabsContainer = html.find('.glog2d6-tabs');
  if (tabsContainer.length) {
    const tabs = tabsContainer.find('.tab');
    const contents = tabsContainer.find('.tab-content');

    // Set first tab as active
    tabs.first().addClass('active');
    contents.first().addClass('active');

    // Handle tab clicks
    tabs.on('click', (ev) => {
      const tab = $(ev.currentTarget);
      const tabId = tab.data('tab');

      // Update active tab
      tabs.removeClass('active');
      tab.addClass('active');

      // Update active content
      contents.removeClass('active');
      tabsContainer.find(`.tab-content[data-tab="${tabId}"]`).addClass('active');
    });
  }
});

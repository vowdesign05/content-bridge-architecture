(() => {
  const sections = document.querySelectorAll('.sec9');
  if (!sections.length) return;

  sections.forEach((section, sectionIndex) => {
    const tabList = section.querySelector('.tabs');
    const tabs = Array.from(section.querySelectorAll('.tab-btn'));
    const wrapper = section.querySelector('.tab-wrapper');
    const panels = Array.from(section.querySelectorAll('.tab-contents'));

    if (!tabList || !wrapper || tabs.length === 0 || panels.length === 0) return;

    const tabCount = Math.min(tabs.length, panels.length);
    const scopedTabs = tabs.slice(0, tabCount);
    const scopedPanels = panels.slice(0, tabCount);

    tabList.setAttribute('role', 'tablist');
    wrapper.classList.add('is-ready');

    const activateTab = (nextIndex, shouldFocus = false) => {
      scopedTabs.forEach((tab, index) => {
        const isActive = index === nextIndex;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      scopedPanels.forEach((panel, index) => {
        const isActive = index === nextIndex;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      if (shouldFocus) scopedTabs[nextIndex].focus();
    };

    scopedTabs.forEach((tab, index) => {
      const tabId = tab.id || `setup-guide-tab-${sectionIndex}-${index}`;
      const panelId = scopedPanels[index].id || `setup-guide-panel-${sectionIndex}-${index}`;

      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panelId);

      scopedPanels[index].id = panelId;
      scopedPanels[index].setAttribute('role', 'tabpanel');
      scopedPanels[index].setAttribute('aria-labelledby', tabId);

      tab.addEventListener('click', () => activateTab(index));

      tab.addEventListener('keydown', (event) => {
        const currentIndex = scopedTabs.indexOf(document.activeElement);
        if (currentIndex < 0) return;

        let nextIndex = currentIndex;

        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % scopedTabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + scopedTabs.length) % scopedTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = scopedTabs.length - 1;
        else return;

        event.preventDefault();
        activateTab(nextIndex, true);
      });
    });

    const initialIndex = scopedTabs.findIndex((tab) => tab.classList.contains('is-active'));
    activateTab(initialIndex >= 0 ? initialIndex : 0);
  });
})();

(function () {
  const NAV_SECTIONS = [
    {
      label: 'Track & Field',
      links: [
        { label: 'Team Simulator', path: 'TrackAndField/team/index.html' },
        { label: 'Athlete Charts', path: 'TrackAndField/athlete/index.html' },
        { label: 'Meet All Results', path: 'TrackAndField/meet/allResults/index.html' },
        { label: 'Meet Event Results', path: 'TrackAndField/meet/eventResults/index.html' },
        { type: 'divider' },
        { label: 'Division Simulator', path: 'division/index.html' }
      ]
    },
    {
      label: 'Cross Country',
      links: [
        { label: 'Team Simulator', path: 'CrossCountry/team/index.html' },
        { label: 'Athlete Charts', path: 'CrossCountry/athlete/index.html' },
        { label: 'Meet Results', path: 'CrossCountry/meet/index.html' },
        { type: 'divider' }
      ]
    }
  ];

  const STANDALONE_LINKS = [{ label: 'Home', path: 'index.html' }];

  document.addEventListener('DOMContentLoaded', insertNavbar);

  function insertNavbar() {
    if (document.querySelector('nav[data-component="athletic-navbar"]')) {
      return;
    }

    const rootPrefix = getRootPrefix();
    const navbar = buildNavbar(rootPrefix);

    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(navbar, body.firstChild);
    } else {
      body.appendChild(navbar);
    }

    setupBurger(navbar);
    setupDropdowns(navbar);
  }

  function getRootPrefix() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const marker = '/sidepanel/';
    const index = path.indexOf(marker);

    if (index === -1) {
      const lastSlash = path.lastIndexOf('/');
      return path.substring(0, lastSlash + 1);
    }

    return path.substring(0, index + marker.length);
  }

  function buildNavbar(rootPrefix) {
    const nav = document.createElement('nav');
    nav.className = 'navbar is-dark';
    nav.dataset.component = 'athletic-navbar';
    nav.style.position = 'sticky';
    nav.style.top = '0';
    nav.style.zIndex = '1000';

    const brand = document.createElement('div');
    brand.className = 'navbar-brand';

    const brandLink = document.createElement('a');
    brandLink.className = 'navbar-item';
    brandLink.href = rootPrefix + 'index.html';
    const brandTitle = document.createElement('strong');
    brandTitle.textContent = 'Athletic Helper';
    brandLink.appendChild(brandTitle);
    brand.appendChild(brandLink);

    const burger = document.createElement('a');
    burger.className = 'navbar-burger';
    burger.setAttribute('role', 'button');
    burger.setAttribute('aria-label', 'menu');
    burger.setAttribute('aria-expanded', 'false');
    const burgerTargetId = 'athletic-navbar-menu';
    burger.dataset.target = burgerTargetId;
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.setAttribute('aria-hidden', 'true');
      burger.appendChild(span);
    }
    brand.appendChild(burger);

    nav.appendChild(brand);

    const menu = document.createElement('div');
    menu.className = 'navbar-menu';
    menu.id = 'athletic-navbar-menu';

    const start = document.createElement('div');
    start.className = 'navbar-start';

    NAV_SECTIONS.forEach(section => {
      const sectionItem = document.createElement('div');
      sectionItem.className = 'navbar-item has-dropdown is-hoverable';

      const sectionTrigger = document.createElement('a');
      sectionTrigger.className = 'navbar-link';
      sectionTrigger.href = '#';
      sectionTrigger.setAttribute('role', 'button');
      sectionTrigger.setAttribute('aria-haspopup', 'true');
      sectionTrigger.setAttribute('aria-expanded', 'false');
      sectionTrigger.textContent = section.label;
      sectionItem.appendChild(sectionTrigger);

      const dropdown = document.createElement('div');
      dropdown.className = 'navbar-dropdown';

      section.links.forEach(link => {
        if (link.type === 'divider') {
          const divider = document.createElement('hr');
          divider.className = 'navbar-divider';
          dropdown.appendChild(divider);
          return;
        }

        const dropdownLink = document.createElement('a');
        dropdownLink.className = 'navbar-item';
        dropdownLink.href = rootPrefix + link.path;
        dropdownLink.textContent = link.label;
        dropdown.appendChild(dropdownLink);
      });

      sectionItem.appendChild(dropdown);
      start.appendChild(sectionItem);
    });

    STANDALONE_LINKS.forEach(link => {
      const anchor = document.createElement('a');
      anchor.className = 'navbar-item';
      anchor.href = rootPrefix + link.path;
      anchor.textContent = link.label;
      start.appendChild(anchor);
    });

    menu.appendChild(start);
    nav.appendChild(menu);

    return nav;
  }

  function setupBurger(nav) {
    const burger = nav.querySelector('.navbar-burger');
    const targetId = burger ? burger.dataset.target : null;
    const menu = targetId ? nav.querySelector(`#${CSS.escape(targetId)}`) : null;

    if (!burger || !menu) {
      return;
    }

    burger.addEventListener('click', () => {
      const isActive = burger.classList.toggle('is-active');
      menu.classList.toggle('is-active', isActive);
      burger.setAttribute('aria-expanded', String(isActive));
    });
  }

  function setupDropdowns(nav) {
    const dropdownItems = Array.from(nav.querySelectorAll('.navbar-item.has-dropdown'));

    if (!dropdownItems.length) {
      return;
    }

    const closeAll = () => {
      dropdownItems.forEach(item => item.classList.remove('is-active'));
    };

    dropdownItems.forEach(item => {
      const trigger = item.querySelector('.navbar-link');
      if (!trigger) {
        return;
      }

      trigger.addEventListener('click', event => {
        const href = trigger.getAttribute('href');
        if (!href || href === '#') {
          event.preventDefault();
        }

        const wasActive = item.classList.contains('is-active');
        closeAll();

        if (!wasActive) {
          item.classList.add('is-active');
        }
      });
    });

    document.addEventListener('click', event => {
      if (!nav.contains(event.target)) {
        closeAll();
      }
    });

    const dropdownLinks = nav.querySelectorAll('.navbar-dropdown .navbar-item[href]');
    dropdownLinks.forEach(link => {
      link.addEventListener('click', () => closeAll());
    });
  }
})();

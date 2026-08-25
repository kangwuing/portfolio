const root = document.documentElement;
const toggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector("#theme-color");
const storageKey = "portfolio-theme";
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const getStoredTheme = () => {
    try {
        const value = localStorage.getItem(storageKey);
        return value === "light" || value === "dark" ? value : null;
    } catch {
        return null;
    }
};

const setTheme = (theme, persist = false) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    if (themeColor) {
        themeColor.content = nextTheme === "dark" ? "#070b12" : "#edf4ff";
    }

    if (toggle) {
        const isDark = nextTheme === "dark";
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
        toggle.querySelector('[data-theme-icon="dark"]')?.toggleAttribute("hidden", isDark);
        toggle.querySelector('[data-theme-icon="light"]')?.toggleAttribute("hidden", !isDark);
        const label = toggle.querySelector(".theme-toggle__label");
        if (label) label.textContent = isDark ? "Light" : "Dark";
    }

    if (persist) {
        try {
            localStorage.setItem(storageKey, nextTheme);
        } catch {
            // The selected theme still applies for this visit.
        }
    }
};

if (toggle) {
    setTheme(root.dataset.theme || getStoredTheme() || (mediaQuery.matches ? "dark" : "light"));

    toggle.addEventListener("click", () => {
        const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
        if (!document.startViewTransition || reducedMotionQuery.matches) {
            setTheme(nextTheme, true);
            return;
        }

        const bounds = toggle.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );
        root.style.setProperty("--theme-x", `${x}px`);
        root.style.setProperty("--theme-y", `${y}px`);
        root.style.setProperty("--theme-radius", `${radius}px`);
        document.startViewTransition(() => setTheme(nextTheme, true));
    });

    mediaQuery.addEventListener("change", (event) => {
        if (!getStoredTheme()) setTheme(event.matches ? "dark" : "light");
    });
} else {
    // Compatibility redirect for visitors with the former TOEIC homepage cached.
    const refreshedUrl = new URL("./", import.meta.url);
    refreshedUrl.searchParams.set("portfolio-version", "20260825-liquid-glass");
    if (window.location.href !== refreshedUrl.toString()) {
        window.location.replace(refreshedUrl.toString());
    }
}

const scrollProgress = document.querySelector("#scroll-progress");
const updateScrollProgress = () => {
    if (!scrollProgress) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    scrollProgress.style.width = `${progress * 100}%`;
};

updateScrollProgress();
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);

const updateAmbientScroll = () => {
    if (reducedMotionQuery.matches) return;
    root.style.setProperty("--ambient-shift", `${Math.min(window.scrollY * 0.018, 72)}px`);
};

updateAmbientScroll();
window.addEventListener("scroll", updateAmbientScroll, { passive: true });

const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const primaryNavigation = document.querySelector("#primary-navigation");
const desktopNavigationQuery = window.matchMedia("(min-width: 1024px)");

const setMobileMenu = (isOpen) => {
    if (!mobileMenuToggle || !primaryNavigation) return;
    const shouldOpen = !desktopNavigationQuery.matches && isOpen;
    primaryNavigation.classList.toggle("is-open", shouldOpen);
    primaryNavigation.setAttribute("aria-hidden", String(!desktopNavigationQuery.matches && !shouldOpen));
    mobileMenuToggle.setAttribute("aria-expanded", String(shouldOpen));
    mobileMenuToggle.setAttribute("aria-label", shouldOpen ? "Close navigation menu" : "Open navigation menu");
    const icon = mobileMenuToggle.querySelector("i");
    icon?.classList.toggle("fa-bars", !shouldOpen);
    icon?.classList.toggle("fa-xmark", shouldOpen);
};

if (mobileMenuToggle && primaryNavigation) {
    setMobileMenu(false);
    mobileMenuToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        setMobileMenu(mobileMenuToggle.getAttribute("aria-expanded") !== "true");
    });
    primaryNavigation.addEventListener("click", (event) => {
        if (event.target.closest('a[href^="#"]')) setMobileMenu(false);
    });
    document.addEventListener("click", (event) => {
        if (!primaryNavigation.contains(event.target)) setMobileMenu(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mobileMenuToggle.getAttribute("aria-expanded") === "true") {
            setMobileMenu(false);
            mobileMenuToggle.focus();
        }
    });
    desktopNavigationQuery.addEventListener("change", () => setMobileMenu(false));
}

const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

if (sections.length) {
    const updateActiveSection = () => {
        const readingLine = window.scrollY + window.innerHeight * 0.36;
        const activeSection = sections.reduce(
            (current, section) => (section.offsetTop <= readingLine ? section : current),
            sections[0]
        );
        navLinks.forEach((link) => {
            const isCurrent = link.getAttribute("href") === `#${activeSection.id}`;
            if (isCurrent) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
}

if (window.matchMedia("(pointer: fine)").matches) {
    let ambientFrame = 0;
    window.addEventListener("pointermove", (event) => {
        if (reducedMotionQuery.matches || ambientFrame) return;
        ambientFrame = window.requestAnimationFrame(() => {
            const xRatio = event.clientX / window.innerWidth;
            const yRatio = event.clientY / window.innerHeight;
            root.style.setProperty("--ambient-a-x", `${10 + xRatio * 10}%`);
            root.style.setProperty("--ambient-a-y", `${3 + yRatio * 8}%`);
            root.style.setProperty("--ambient-b-x", `${92 - xRatio * 9}%`);
            root.style.setProperty("--ambient-b-y", `${18 + yRatio * 8}%`);
            ambientFrame = 0;
        });
    }, { passive: true });

    const attachSpotlight = (surface) => {
        surface.addEventListener("pointermove", (event) => {
            const bounds = surface.getBoundingClientRect();
            surface.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
            surface.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
        });
    };

    document.querySelectorAll(".liquid-glass, .interactive-surface").forEach(attachSpotlight);

    const dynamicSurfaceObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.matches(".liquid-glass, .interactive-surface")) attachSpotlight(node);
                node.querySelectorAll?.(".liquid-glass, .interactive-surface").forEach(attachSpotlight);
            });
        });
    });
    dynamicSurfaceObserver.observe(document.body, { childList: true, subtree: true });
}

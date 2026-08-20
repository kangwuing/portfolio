(() => {
    "use strict";

    const list = document.querySelector("#publication-groups");
    const status = document.querySelector("#publication-sync-status");
    if (!list || !status) return;

    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const externalLink = (publication, dark) => {
        const link = element(
            "a",
            dark
                ? "shrink-0 text-[10px] bg-white/10 text-white px-3 py-1 rounded font-bold hover:bg-white hover:text-slate-900 transition uppercase"
                : "shrink-0 text-[10px] bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold hover:bg-blue-600 hover:text-white transition uppercase"
        );
        link.href = publication.doiUrl || publication.scholarUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const icon = element("i", "fa-solid fa-arrow-up-right-from-square mr-1");
        link.append(icon, document.createTextNode(publication.doiUrl ? "DOI Link" : "Scholar"));
        return link;
    };

    const badge = (publication, dark) => {
        const label = publication.badge || (publication.kind === "conference" ? "Conference" : "Journal");
        return element(
            "span",
            dark
                ? "bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-indigo-500/30"
                : "bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
            label
        );
    };

    const publicationCard = (publication, dark) => {
        const card = element(
            "article",
            dark
                ? "group p-6 bg-slate-900 text-white rounded-2xl border border-slate-700 hover:border-indigo-400 transition"
                : "group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition"
        );
        card.setAttribute("data-aos", "fade-up");

        const header = element("div", "flex flex-wrap justify-between items-start gap-3 mb-3");
        const labels = element("div", "flex flex-wrap items-center gap-2");
        labels.append(
            element(
                "span",
                dark
                    ? "text-indigo-400 font-bold text-sm uppercase tracking-widest"
                    : "text-blue-600 font-bold text-sm",
                publication.year || "In press"
            ),
            badge(publication, dark)
        );
        if (publication.citations > 0) {
            labels.append(
                element(
                    "span",
                    dark
                        ? "text-[10px] text-slate-300 border border-slate-600 px-2 py-0.5 rounded-full font-bold uppercase"
                        : "text-[10px] text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold uppercase",
                    `${publication.citations} citation${publication.citations === 1 ? "" : "s"}`
                )
            );
        }
        header.append(labels, externalLink(publication, dark));

        const titleLink = element(
            "a",
            dark ? "hover:text-indigo-300 transition" : "hover:text-blue-600 transition",
            publication.title
        );
        titleLink.href = publication.scholarUrl;
        titleLink.target = "_blank";
        titleLink.rel = "noopener noreferrer";
        const title = element("h4", "text-xl font-bold mb-2");
        title.append(titleLink);

        const authors = element(
            "p",
            dark ? "text-slate-300 text-sm mb-1" : "text-slate-500 text-sm mb-1",
            publication.authors
        );
        const venue = element(
            "p",
            dark ? "text-slate-400 text-sm" : "text-slate-600 text-sm",
            publication.venue
        );
        card.append(header, title, authors, venue);
        return card;
    };

    const publicationSection = (title, publications, dark) => {
        const section = element("div", "mb-16 last:mb-0");
        const heading = element(
            "h3",
            dark
                ? "text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-8 border-l-4 border-indigo-600 pl-4 italic"
                : "text-sm font-bold text-blue-600 uppercase tracking-[0.2em] mb-8 border-l-4 border-blue-600 pl-4 italic",
            title
        );
        const cards = element("div", "space-y-8");
        publications.forEach((publication) => cards.append(publicationCard(publication, dark)));
        section.append(heading, cards);
        return section;
    };

    const formatSyncTime = (isoDate) => {
        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) return "latest available Scholar data";
        return new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        }).format(date);
    };

    fetch("data/publications.json", { cache: "no-store" })
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            const publications = Array.isArray(data.publications) ? data.publications : [];
            if (!publications.length) throw new Error("No publications found");

            const journals = publications.filter((item) => item.kind !== "conference");
            const conferences = publications.filter((item) => item.kind === "conference");
            list.replaceChildren();
            if (journals.length) list.append(publicationSection("Journal Publications", journals, false));
            if (conferences.length) list.append(publicationSection("Conference Proceedings", conferences, true));

            list.setAttribute("aria-busy", "false");
            status.textContent = `${publications.length} publications · Synced ${formatSyncTime(data.lastSyncedAt)}`;
            window.AOS?.refreshHard();
        })
        .catch(() => {
            list.replaceChildren(
                element(
                    "p",
                    "rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800",
                    "Publication data is temporarily unavailable. Please use the Google Scholar link above."
                )
            );
            list.setAttribute("aria-busy", "false");
            status.textContent = "Google Scholar remains the source of record";
        });
})();

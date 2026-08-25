(() => {
    "use strict";

    const grid = document.querySelector("#certification-grid");
    const status = document.querySelector("#certification-status");
    if (!grid || !status) return;

    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const actionLink = ({ href, label, icon, primary = false, download = false }) => {
        const link = element(
            "a",
            primary
                ? "primary-button inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition"
                : "glass-action inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition"
        );
        link.href = href;
        link.target = download ? "_self" : "_blank";
        link.rel = "noopener noreferrer";
        if (download) link.setAttribute("download", "");
        link.append(element("i", `fa-solid ${icon}`), document.createTextNode(label));
        return link;
    };

    const certificateCard = (certificate) => {
        const card = element(
            "article",
            "credential-card liquid-glass interactive-surface group flex h-full flex-col overflow-hidden rounded-3xl border transition"
        );
        card.setAttribute("data-aos", "fade-up");

        const preview = element("a", "credential-preview relative block aspect-[16/10] overflow-hidden border-b");
        preview.href = certificate.pdfPath || certificate.credentialUrl;
        preview.target = "_blank";
        preview.rel = "noopener noreferrer";
        preview.setAttribute("aria-label", `View ${certificate.title}`);

        const image = element("img", "h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.025]");
        image.src = certificate.thumbnailPath;
        image.alt = `${certificate.title} certificate preview`;
        image.loading = "lazy";
        image.decoding = "async";

        const previewShade = element("span", "absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/45 via-transparent to-transparent p-4 opacity-0 transition group-hover:opacity-100");
        previewShade.append(element("span", "credential-preview-cta rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider", certificate.pdfPath ? "View original PDF" : "View official credential"));
        const validity = element("span", "credential-validity");
        validity.append(element("span", "status-dot"), document.createTextNode("Verified"));
        preview.append(image, previewShade, validity);

        const body = element("div", "flex flex-1 flex-col p-6");
        const title = element("h3", "text-xl font-extrabold leading-snug text-slate-900", certificate.title);
        const issued = element("time", "credential-issued", certificate.issued);
        const heading = element("div", "credential-heading");
        heading.append(title, issued);
        const issuer = element("p", "mt-2 text-sm font-semibold text-blue-600", certificate.issuer);
        const credential = element("p", "mt-3 break-all text-[11px] text-slate-400");
        credential.append(
            element("span", "font-bold uppercase tracking-wider text-slate-500", "Credential ID "),
            document.createTextNode(certificate.credentialId)
        );

        const skills = element("div", "mt-4 flex flex-wrap gap-2");
        (certificate.skills || []).forEach((skill) => {
            skills.append(element("span", "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600", skill));
        });

        const actions = element("div", "mt-6 flex flex-wrap gap-2");
        actions.append(actionLink({ href: certificate.credentialUrl, label: "Credential", icon: "fa-shield-halved", primary: true }));
        if (certificate.pdfPath) {
            actions.append(actionLink({ href: certificate.pdfPath, label: "View PDF", icon: "fa-file-pdf" }));
            actions.append(actionLink({ href: certificate.pdfPath, label: "Download", icon: "fa-download", download: true }));
        }

        body.append(heading, issuer, credential, skills, actions);
        card.append(preview, body);
        return card;
    };

    fetch("data/certifications.json", { cache: "no-store" })
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            const certificates = Array.isArray(data.certifications) ? data.certifications : [];
            if (!certificates.length) throw new Error("No certificates found");

            grid.replaceChildren(...certificates.map(certificateCard));
            grid.setAttribute("aria-busy", "false");
            const pdfCount = certificates.filter((certificate) => certificate.pdfPath).length;
            status.textContent = `${certificates.length} verified credentials · ${pdfCount} certificate PDFs`;
            window.AOS?.refreshHard();
        })
        .catch(() => {
            grid.replaceChildren(
                element(
                    "p",
                    "col-span-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800",
                    "Certificate data is temporarily unavailable. Please use the LinkedIn profile link."
                )
            );
            grid.setAttribute("aria-busy", "false");
            status.textContent = "Credential links remain the source of record";
        });
})();

const MENUS = [
    {
        label: "File",
        items: [
            {
                label: "Save",
                shortcut: "Ctrl+S",
                action: "driveMonaco.action.save",
            },
            {
                label: "Create New File",
                action: "driveMonaco.action.createFile",
            },
        ],
    },
    {
        label: "View",
        items: [
            {
                label: "Command Palette",
                shortcut: "F1",
                action: "editor.action.quickCommand",
            },
            { separator: true },
            {
                label: "Toggle Word Wrap",
                shortcut: "Alt+H",
                action: "driveMonaco.action.toggleWordWrap",
            },
            {
                label: "Toggle Whitespace",
                action: "driveMonaco.action.toggleWhitespace",
            },
            {
                label: "Change Line Numbers",
                action: "driveMonaco.action.changeLineNumbers",
            },
        ],
    },
    {
        label: "Settings",
        items: [
            {
                label: "Change Theme",
                action: "driveMonaco.action.changeTheme",
            },
            {
                label: "Change Language",
                action: "driveMonaco.action.changeLanguage",
            },
        ],
    },
];

export function createMenubar(editor) {
    const container = document.getElementById("menubar");
    let openMenu = null;

    for (const menu of MENUS) {
        const menuItem = document.createElement("div");
        menuItem.className = "menu-item";
        menuItem.appendChild(document.createTextNode(menu.label));

        const dropdown = document.createElement("div");
        dropdown.className = "menu-dropdown";

        for (const item of menu.items) {
            if (item.separator) {
                const sep = document.createElement("div");
                sep.className = "separator";
                dropdown.appendChild(sep);
                continue;
            }

            const entry = document.createElement("div");
            entry.className = "dropdown-item";

            const labelSpan = document.createElement("span");
            labelSpan.textContent = item.label;
            entry.appendChild(labelSpan);

            if (item.shortcut) {
                const shortcutSpan = document.createElement("span");
                shortcutSpan.className = "shortcut";
                shortcutSpan.textContent = item.shortcut;
                entry.appendChild(shortcutSpan);
            }

            entry.addEventListener("click", (e) => {
                e.stopPropagation();
                closeAll();
                editor.trigger("menubar", item.action, null);
                editor.focus();
            });

            dropdown.appendChild(entry);
        }

        menuItem.appendChild(dropdown);

        menuItem.addEventListener("click", (e) => {
            e.stopPropagation();
            if (openMenu === menuItem) {
                closeAll();
            } else {
                closeAll();
                menuItem.classList.add("open");
                openMenu = menuItem;
            }
        });

        menuItem.addEventListener("mouseenter", () => {
            if (openMenu && openMenu !== menuItem) {
                closeAll();
                menuItem.classList.add("open");
                openMenu = menuItem;
            }
        });

        container.appendChild(menuItem);
    }

    function closeAll() {
        if (openMenu) {
            openMenu.classList.remove("open");
            openMenu = null;
        }
    }

    document.addEventListener("click", closeAll);
    editor.onDidFocusEditorText(closeAll);
}

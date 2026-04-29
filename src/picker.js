import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices";
import { IQuickInputService } from "monaco-editor/esm/vs/platform/quickinput/common/quickInput";

/**
 * Show Monaco's native QuickPick UI.
 *
 * @param {Array<{label: string, value: any, description?: string, current?: boolean}>} items
 * @param {{placeholder?: string}} [opts]
 * @returns {Promise<any|null>} the picked item's `value`, or null if cancelled
 */
export async function showPicker(items, opts = {}) {
    const qis = StandaloneServices.get(IQuickInputService);
    const picks = items.map((item) => ({
        label: item.label + (item.current ? "  $(check)" : ""),
        description: item.description,
        _value: item.value,
    }));
    const picked = await qis.pick(picks, {
        placeHolder: opts.placeholder,
    });
    return picked ? picked._value : null;
}

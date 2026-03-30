const contributions = new Map();

export function registerContribution(id, instance) {
    contributions.set(id, instance);
}

export function getContribution(id) {
    return contributions.get(id);
}

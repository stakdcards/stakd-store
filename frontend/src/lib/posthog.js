import posthog from 'posthog-js';

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY;
const PH_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initPostHog() {
    if (!PH_KEY) return;
    posthog.init(PH_KEY, {
        api_host: PH_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
    });
}

export function identifyUser(userId, traits = {}) {
    if (!PH_KEY) return;
    posthog.identify(userId, traits);
}

export function resetUser() {
    if (!PH_KEY) return;
    posthog.reset();
}

export function track(event, properties = {}) {
    if (!PH_KEY) return;
    posthog.capture(event, properties);
}

export default posthog;

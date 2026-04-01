"use client";

import { useEffect, useRef } from "react";
import { useCommercialStore } from "@/store/commercial-store";

const SCRAPE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LS_KEY = "lastMarketScrapeTime";

/**
 * GlobalMarketScraper
 * Runs in root layout — silently scrapes market prices every 6 hours in the background.
 * Uses localStorage to persist the last scrape timestamp across page refreshes.
 * Renders nothing (null).
 */
export function GlobalMarketScraper() {
    const addMarketPrice = useCommercialStore((s) => s.addMarketPrice);
    const syncFromMemory = useCommercialStore((s) => s.syncFromMemory);
    const scrapingRef = useRef(false);

    useEffect(() => {
        // Ensure latest data is loaded into the store on app boot
        syncFromMemory();
    }, [syncFromMemory]);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const doScrape = async () => {
            if (scrapingRef.current) return;
            scrapingRef.current = true;

            try {
                const res = await fetch("/api/market-scrape", { method: "POST" });
                const data = await res.json();

                if (data.success && data.prices) {
                    const p = data.prices;
                    await addMarketPrice({
                        date: p.date,
                        ici_1: p.ici_1,
                        ici_2: p.ici_2,
                        ici_3: p.ici_3,
                        ici_4: p.ici_4,
                        ici_5: p.ici_5,
                        newcastle: p.newcastle,
                        hba: p.hba,
                        source: p.source,
                    });

                    // Persist timestamp
                    localStorage.setItem(LS_KEY, Date.now().toString());
                    console.log("[GlobalMarketScraper] Scrape succeeded at", new Date().toLocaleTimeString());
                } else {
                    console.warn("[GlobalMarketScraper] Scrape returned error:", data.error);
                }
            } catch (err) {
                console.error("[GlobalMarketScraper] Scrape failed:", err);
            } finally {
                scrapingRef.current = false;
            }
        };

        const scheduleNext = () => {
            // Clear any existing interval before setting a new one
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(doScrape, SCRAPE_INTERVAL_MS);
        };

        // Determine how long since last scrape
        const lastStr = localStorage.getItem(LS_KEY);
        const lastTime = lastStr ? parseInt(lastStr, 10) : 0;
        const elapsed = Date.now() - lastTime;

        if (elapsed >= SCRAPE_INTERVAL_MS || lastTime === 0) {
            // Overdue or first time — scrape after a short delay (3s to let the app settle)
            timeoutId = setTimeout(() => {
                doScrape().then(scheduleNext);
            }, 3000);
        } else {
            // Wait for the remaining time, then scrape and start the regular interval
            const remaining = SCRAPE_INTERVAL_MS - elapsed;
            console.log(`[GlobalMarketScraper] Next scrape in ${Math.round(remaining / 60000)} minutes`);
            timeoutId = setTimeout(() => {
                doScrape().then(scheduleNext);
            }, remaining);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [addMarketPrice]);

    return null;
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Handlebars throws "Missing helper" when a template calls an unregistered
 * helper *with arguments*, which takes down the whole sheet render rather than
 * just that expression. The item sheets are covered by rendering them; the
 * actor sheets need a real Actor to render, so they are checked statically.
 */

/** Helpers Foundry registers itself, plus Handlebars' own block keywords. */
const BUILT_IN = new Set([
    // Handlebars
    "if", "unless", "each", "with", "else", "log", "lookup", "blockHelperMissing",
    // Foundry comparison helpers (v12+)
    "eq", "ne", "lt", "gt", "lte", "gte", "not", "and", "or",
    // Foundry utility helpers
    "checked", "concat", "disabled", "editor", "filePicker", "formField",
    "formGroup", "formInput", "ifThen", "localize", "numberFormat", "numberInput",
    "object", "radioBoxes", "rangePicker", "selectOptions", "timeSince"
]);

function templateFiles() {
    return globSync("templates/**/*.hbs", { cwd: ROOT }).sort();
}

/** Helper names a template invokes with at least one argument. */
export function helpersUsedIn(source) {
    const used = new Set();
    const body = source.replace(/\{\{![\s\S]*?\}\}/g, "");

    // Only look inside mustaches. Scanning the raw source would read prose in
    // HTML attributes -- "(a pinch of sulfur)" -- as a subexpression.
    for (const [expression] of body.matchAll(/\{\{[^{}]*\}\}/g)) {
        const inner = expression.slice(2, -2).replace(/^[#/>^]\s*/, "").trim();

        // {{helper arg}}
        const call = /^([A-Za-z_][\w-]*)\s+\S/.exec(inner);
        if (call) used.add(call[1]);

        // (helper arg) subexpressions
        for (const [, name] of inner.matchAll(/\(\s*([A-Za-z_][\w-]*)\s+/g)) {
            used.add(name);
        }
    }

    for (const name of BUILT_IN) used.delete(name);
    return used;
}

/** Helper names the system registers at runtime. */
function registeredHelpers() {
    const entry = readFileSync(resolve(ROOT, "glog2d6.mjs"), "utf8");
    return new Set(
        [...entry.matchAll(/registerHelper\(\s*['"]([\w-]+)['"]/g)].map(m => m[1])
    );
}

describe("template helpers", () => {
    const registered = registeredHelpers();

    it("finds the helpers the system registers", () => {
        expect(registered.size).toBeGreaterThan(5);
        expect(registered).toContain("upperCase");
    });

    it.each(templateFiles())("%s calls only registered helpers", file => {
        const used = [...helpersUsedIn(readFileSync(resolve(ROOT, file), "utf8"))];
        const missing = used.filter(name => !registered.has(name));
        expect(missing, `${file} calls unregistered helper(s): ${missing.join(", ")}`).toEqual([]);
    });

    it("registers a formatDate helper for wound timestamps", () => {
        // wounds-tab.hbs renders {{formatDate wound.dateAcquired}} for every
        // wound, so without this a character with any wound cannot render.
        expect(registered).toContain("formatDate");
    });
});

describe("the helper scanner itself", () => {
    it("spots a helper call with arguments", () => {
        expect([...helpersUsedIn("{{myHelper foo}}")]).toEqual(["myHelper"]);
        expect([...helpersUsedIn("{{#myBlock foo}}x{{/myBlock}}")]).toEqual(["myBlock"]);
        expect([...helpersUsedIn("{{#if (myTest a b)}}x{{/if}}")]).toEqual(["myTest"]);
    });

    it("ignores plain property lookups and built-ins", () => {
        expect([...helpersUsedIn("{{system.description}}")]).toEqual([]);
        expect([...helpersUsedIn("{{#each items as |i|}}{{/each}}")]).toEqual([]);
        expect([...helpersUsedIn("{{#if (eq a b)}}{{/if}}")]).toEqual([]);
    });

    it("ignores commented-out markup", () => {
        expect([...helpersUsedIn("{{!-- {{ghostHelper x}} --}}")]).toEqual([]);
    });

    it("does not read prose in HTML attributes as a helper call", () => {
        expect([...helpersUsedIn('<input placeholder="e.g., V, S, M (a pinch of sulfur)" />')]).toEqual([]);
        expect([...helpersUsedIn('<input title="Default: #ff8800 (warm orange)" />')]).toEqual([]);
    });
});

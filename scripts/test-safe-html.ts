import { sanitizeHTML } from '../lib/utils/sanitize-html';

const payloads = [
    {
        name: "Basic Content",
        input: "<p>Hello <b>world</b></p>",
        description: "Should allow standard p and b tags"
    },
    {
        name: "Script Tag Injection",
        input: `<script>alert("XSS")</script>`,
        description: "Should completely strip script tags"
    },
    {
        name: "Javascript URI in a tag",
        input: `<a href="javascript:alert(1)">Click me</a>`,
        description: "Should neutralize the javascript URI scheme"
    },
    {
        name: "Onerror in allowed tag",
        input: `<b onerror="alert(1)">Fail</b>`,
        description: "Should strip the onerror attribute"
    },
    {
        name: "Data attribute leakage",
        input: `<p data-hack="exploit">Content</p>`,
        description: "Should strip data-* attributes since we use ALLOW_DATA_ATTR: false"
    },
    {
        name: "Nested exploitation",
        input: `<<script>alert("test");//<</script>`,
        description: "Should safely handle malformed or nested script tag bypass attempts"
    }
];

function runTests() {
    console.log("=== Running SafeHTML XSS Sanitization Tests ===\n");
    let passed = 0;

    payloads.forEach((test, index) => {
        const output = sanitizeHTML(test.input);

        let pass = true;

        if (test.name === "Basic Content") {
            pass = output === "<p>Hello <b>world</b></p>";
        } else if (test.name === "Script Tag Injection") {
            pass = !output.includes("<script>") && !output.includes("alert");
        } else if (test.name === "Javascript URI in a tag") {
            pass = !output.includes("href=\"javascript:");
        } else if (test.name === "Onerror in allowed tag") {
            pass = !output.includes("onerror");
        } else if (test.name === "Data attribute leakage") {
            pass = !output.includes("data-");
        } else if (test.name === "Nested exploitation") {
            pass = !output.includes("<script>") && !output.includes("alert");
        }

        console.log(`Test ${index + 1}: ${test.name}`);
        console.log(`Description: ${test.description}`);
        console.log(`Input:       ${test.input}`);
        console.log(`Output:      ${output}`);
        console.log(`Status:      ${pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}\n`);

        if (pass) passed++;
    });

    console.log("=========================================");
    console.log(`Results: ${passed}/${payloads.length} tests passed.`);
    if (passed !== payloads.length) {
        process.exit(1);
    }
}

runTests();

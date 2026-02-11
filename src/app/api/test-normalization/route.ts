import { normalizeDomain } from '@/utils/domain';
import { NextResponse } from 'next/server';

export async function GET() {
    const cases = [
        { input: 'https://example-test.co.il', expected: 'example-test.co.il' },
        { input: 'example-test.co.il', expected: 'example-test.co.il' },
        { input: 'http://example-test.co.il', expected: 'example-test.co.il' },
        { input: 'https://www.example-test.co.il/', expected: 'example-test.co.il' },
        { input: '   https://example-test.co.il   ', expected: 'example-test.co.il' },
    ];

    const results = cases.map(c => {
        const actual = normalizeDomain(c.input);
        return {
            input: c.input,
            normalized: actual,
            match: actual === c.expected
        };
    });

    // Explicit comparison of the user's reported case
    const case1 = normalizeDomain('https://example-test.co.il');
    const case2 = normalizeDomain('example-test.co.il');
    const conflict = case1 === case2;

    return NextResponse.json({
        results,
        userCase: {
            'https://example-test.co.il': case1,
            'example-test.co.il': case2,
            conflictDetected: conflict
        }
    });
}

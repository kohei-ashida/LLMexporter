import * as path from 'path';
import { glob } from 'glob';

const mocha = require('mocha');

export function run(): Promise<void> {
    // Create the mocha test
    const mochaInstance = new mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err: any, files: string[]) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach((f: string) => mochaInstance.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mochaInstance.run((failures: number) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
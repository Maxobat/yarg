const fs = require('fs');
const Bluebird = require('bluebird');
const readFile = Bluebird.promisify(fs.readFile);
const readdir = Bluebird.promisify(fs.readdir);

class Yarg {
    constructor({ include }) {
        this.ignore = ['node_modules'];
        this.includedExtensions = include || [];
        this.matches = [];
    }

    start() {
        this.resolveIncludedExtensions();
        readFile('package.json', 'utf-8').then(res => {
            this.defineDependencies(JSON.parse(res));
            this.search('./').then(() => {
                this.processOutput();
            });
        });
    }

    resolveIncludedExtensions() {
        this.includedExtensions = this.includedExtensions.map(el => {
            if (el.startsWith('.')) {
                el = el.substr(1);
            }

            return el;
        });

        this.includedExtensions.push('js');
    }

    defineDependencies(config) {
        let base = [];

        if (config.dependencies) {
            base = base.concat(Object.keys(config.dependencies));
        }

        if (config.devDependencies) {
            base = base.concat(Object.keys(config.devDependencies));
        }

        this.owned = base;
    }

    search(dir) {
        return readdir(dir).then(res => {
            let ret = this.getPromise();

            res.forEach(el => {
                let path = this.resolvePath(dir, el);

                ret = ret.then(() => new Promise(resolve => {
                    fs.readFile(path, 'utf-8', (err, file) => {
                        if (err) {
                            if (this.ignore.indexOf(el) === -1) {
                                resolve(this.search(path));
                            } else {
                                resolve(this.getPromise());
                            }
                        } else {
                            if (this.validateFile(path)) {
                                resolve(this.locateTarget(file));
                            } else {
                                resolve(this.getPromise());
                            }
                        }
                    });
                }));
            });

            return ret;
        });
    }

    resolvePath(dir, child) {
        if (dir.substr(-1) !== '/') {
            dir += '/';
        }

        return dir += child;
    }

    validateFile(filePath) {
        const extensionPostition = filePath.lastIndexOf('.');
        const extension = filePath.substr(extensionPostition).substr(1);

        if (this.includedExtensions.indexOf(extension) !== -1) {
            console.log(filePath);
            return true;
        }

        return false;
    }

    locateTarget(output) {
        output.replace(/require\(['"](?!\.\/*)([\w-\.\/]+)/g, (m, group) => {
            if ((this.owned.indexOf(group) === -1) && this.matches.indexOf(group) === -1 && !this.isCore(group)) {
                this.matches.push(group);
            }
        });
    }

    getPromise(base = '') {
        return new Promise(resolve => resolve(base));
    }

    processOutput() {
        if (this.matches.length) {
            console.log('\x1b[36m', 'Run the following:', '\x1b[0m');
            console.log(`yarn add ${this.matches.join(' ')}`);
        } else {
            console.log('\x1b[36m', 'Nothing found. You are all set!', '\x1b[0m');
        }
    }

    isCore(mod) {
        return Object.keys(process.binding('natives')).indexOf(mod) !== -1;
    }
}

module.exports = Yarg;

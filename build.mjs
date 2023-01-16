import { exec } from 'node:child_process';
import { lstat, copyFile, rm, mkdir, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function copy(src, dst) {
    const stat = await lstat(src);
    if(stat.isFile()) {
        await copyFile(src, dst);
    } else if(stat.isDirectory()) {
        mkdir(dst, {
            recursive: true
        });
        for(const file of await readdir(src)) {
            copy(join(src, file), join(dst, file));
        }
    } else {
        console.warn(`${src} is not a file or directory`);
    }
}

async function canAccess(file) {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    if(await canAccess('dist/')) {
        await rm('dist/', {
            recursive: true
        });
    }

    await mkdir('dist/');

    try {
        await exec('npx webpack --mode=production');
    } catch (err) {
        console.log(err.stdout);
        console.error(err.stderr);
    }
    await copyFile('node_modules/phaser/dist/phaser.min.js', 'dist/phaser.js');
    await copy('assets/', 'dist/assets/');
    await copy('index-prod.html', 'dist/index.html');
}

main().catch(err => {
    console.error(err);
});
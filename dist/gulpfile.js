"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gulp = require("gulp");
const watch = require("gulp-watch");
const fs = require("fs-extra");
const globToRegExp = require("glob-to-regexp");
const ts = require('gulp-typescript');
const merge = require('merge2');
const filter = require('gulp-filter');
const tsProject = ts.createProject('tsconfig.json', {});
const sourcemaps = require('gulp-sourcemaps');
const src = 'src';
const tsPattern = '**/*.{ts,tsx}';
const tsPatternRegex = globToRegExp(tsPattern, { extended: true });
const copyPattern = '**/*.{js,html}';
const copyPatternRegex = globToRegExp(copyPattern, { extended: true });
const srcTsPattern = src + '/' + tsPattern;
const srcCopyPattern = src + '/' + copyPattern;
const dist = 'dist';
const srcTsFilter = filter([srcTsPattern]);
const srcCopyFilter = filter([srcCopyPattern]);
function process(vinyl) {
    if (vinyl.event !== undefined) {
        switch (vinyl.event) {
            case 'add':
            case 'change':
                {
                    const srctFile = src + '/' + vinyl.relative;
                    const stats = fs.lstatSync(srctFile);
                    if (stats.isFile() || stats.isSymbolicLink()) {
                        const dest = dist + '/' + vinyl.relative.substring(0, vinyl.relative.length - vinyl.basename.length);
                        if (tsPatternRegex.test(srctFile)) {
                            console.log(vinyl.event + ' file => compile: ' + srctFile + ' => ' + dest);
                            compile(gulp.src(srctFile), dest);
                        }
                        else if (copyPatternRegex.test(srctFile)) {
                            console.log(vinyl.event + ' file => copy: ' + srctFile + ' => ' + dest);
                            copy(gulp.src(srctFile), dest);
                        }
                        else {
                            console.log(vinyl.event + ' file => bypass: ' + srctFile + ' => ' + dest);
                        }
                    }
                }
                break;
            case 'unlink':
                {
                    const destFileBase = dist + '/' + vinyl.relative;
                    const destFiles = [destFileBase];
                    if (tsPatternRegex.test(destFileBase)) {
                        const firstPart = destFileBase.substr(0, destFileBase.lastIndexOf('.'));
                        destFiles.push(firstPart + '.js');
                        destFiles.push(firstPart + '.js.map');
                        destFiles.push(firstPart + '.d.ts');
                    }
                    destFiles.forEach(destFile => {
                        if (fs.existsSync(destFile)) {
                            const stats = fs.lstatSync(destFile);
                            if (stats.isFile() || stats.isSymbolicLink()) {
                                console.log('remove file: ' + destFile);
                                fs.unlinkSync(destFile);
                            }
                            else if (stats.isDirectory()) {
                                console.log('remove directory: ' + destFile);
                                fs.removeSync(destFile);
                            }
                        }
                    });
                }
                break;
        }
    }
}
function copy(gulpSrc, dest) {
    gulpSrc.pipe(gulp.dest(dest));
}
function compile(gulpSrc, dest) {
    const tsResult = gulpSrc
        .pipe(sourcemaps.init())
        .pipe(tsProject(ts.reporter.defaultReporter()));
    return merge([
        tsResult.dts
            .pipe(gulp.dest(dest)),
        tsResult.js
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest(dest))
    ]);
}
gulp.task('sanitize', function () {
    if (!fs.existsSync(dist)) {
        fs.mkdirsSync(dist);
    }
    console.log('set dist directory to: ' + dist);
});
gulp.task('clear', ['sanitize'], function () {
    const stats = fs.lstatSync(dist);
    if (stats.isDirectory() || stats.isSymbolicLink()) {
        console.log('clear directory: ' + dist);
        fs.emptyDirSync(dist);
    }
});
gulp.task('copy', function () {
    copy(gulp.src(srcCopyPattern), dist);
});
gulp.task('compile', ['sanitize', 'clear', 'copy'], function () {
    compile(gulp.src(srcTsPattern), dist);
});
gulp.task('watch', ['sanitize', 'clear', 'copy', 'compile'], function () {
    gulp.src(src + '/**/*', { base: src })
        .pipe(watch(src, { base: src, ignoreInitial: true, read: false }, process));
});

//# sourceMappingURL=gulpfile.js.map

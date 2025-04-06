const gulp = require('gulp');
const ts = require('gulp-typescript');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const path = require('path');
const fs = require('fs');

/* ----------------------------------------- */
/*  Compile Sass/SCSS                        */
/* ----------------------------------------- */

const GLOG_SCSS = ["src/styles/**/*.scss"];
function compileSCSS() {
  return gulp.src("src/styles/glog2d6.scss")
    .pipe(sass().on('error', sass.logError))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest("./dist/styles/"))
}

/* ----------------------------------------- */
/*  Compile TypeScript                       */
/* ----------------------------------------- */

function compileTS() {
  // Create a project without directly referencing tsconfig.json
  const tsProject = ts.createProject({
    target: "ES2022",
    module: "ESNext",
    lib: ["DOM", "ES2022"],
    esModuleInterop: true,
    skipLibCheck: true,
    moduleResolution: "node",
    resolveJsonModule: true,
    isolatedModules: true,
    strict: true,
    outDir: "./dist",
    rootDir: "./src",
    sourceMap: true,
    noImplicitAny: false,
    forceConsistentCasingInFileNames: true
  });

  return gulp.src('src/**/*.ts')
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'));
}

/* ----------------------------------------- */
/*  Copy Static Files                        */
/* ----------------------------------------- */

function copyFiles() {
  // Copy templates
  gulp.src("src/templates/**/*.hbs")
    .pipe(gulp.dest("./dist/templates/"));

  // Copy language files
  gulp.src("src/lang/**/*.json")
    .pipe(gulp.dest("./dist/lang/"));

  // Copy root files
  return gulp.src([
      "system.json",
      "template.json",
      "LICENSE",
      "README.md"
    ])
    .pipe(gulp.dest("./dist/"));
}

/* ----------------------------------------- */
/*  Watch Updates                            */
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(GLOG_SCSS, compileSCSS);
  gulp.watch("src/**/*.ts", compileTS);
  gulp.watch(["src/templates/**/*.hbs", "src/lang/**/*.json"], copyFiles);
}

/* ----------------------------------------- */
/*  Clean Dist                               */
/* ----------------------------------------- */

function clean(cb) {
  // If dist exists, delete it
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  cb();
}

/* ----------------------------------------- */
/*  Export Tasks                             */
/* ----------------------------------------- */

exports.clean = clean;
exports.compile = gulp.series(compileSCSS, compileTS, copyFiles);
exports.build = gulp.series(clean, compileSCSS, compileTS, copyFiles);
exports.watch = gulp.series(compileSCSS, compileTS, copyFiles, watchUpdates);
exports.default = exports.build;

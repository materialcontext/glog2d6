const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const path = require('path');
const fs = require('fs');

// Define paths
const paths = {
  src: {
    ts: 'src/**/*.ts',
    scss: 'src/styles/**/*.scss',
    static: [
      'src/**/*.json',
      'src/**/*.html',
      'src/**/*.hbs',
      'src/assets/**/*'
    ]
  },
  dist: 'dist/'
};

// Clean dist directory
function clean(cb) {
  // Simple recursive directory deletion
  if (fs.existsSync(paths.dist)) {
    fs.rmSync(paths.dist, { recursive: true, force: true });
  }
  cb();
}

// TypeScript compilation
function compileTS() {
  const tsProject = ts.createProject('tsconfig.json');
  return gulp.src(paths.src.ts)
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.dist));
}

// Compile SCSS
function compileScss() {
  return gulp.src(paths.src.scss)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([autoprefixer()])) // Fixed: Use postcss with autoprefixer
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(path.join(paths.dist, 'styles')));
}

// Copy static files
function copyStatic() {
  return gulp.src(paths.src.static, { base: 'src' })
    .pipe(gulp.dest(paths.dist));
}

// Watch for changes
function watch() {
  gulp.watch(paths.src.ts, compileTS);
  gulp.watch(paths.src.scss, compileScss);
  gulp.watch(paths.src.static, copyStatic);
}

// Define complex tasks
const build = gulp.series(clean, gulp.parallel(compileTS, compileScss, copyStatic));

// Export tasks
exports.clean = clean;
exports.build = build;
exports.watch = gulp.series(build, watch);
exports.default = build;

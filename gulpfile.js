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

// System directory name - should match your system.json "id"
const systemName = 'glog2d6';

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
    ],
    root: [
      'system.json',
      'template.json',
      'README.md',
      'LICENSE',
      'CHANGELOG.md'
    ]
  },
  dist: `dist/${systemName}/`
};

// Clean dist directory
function clean(cb) {
  // Simple recursive directory deletion
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
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
    // Ensure the entry point file is properly named
    .pipe(rename(function(path) {
      // If this is the main entry file src/glog2d6.ts, rename it to match the system.json entry
      if (path.dirname === '.' && path.basename === 'glog2d6') {
        path.basename = 'glog2d6';
      }
      return path;
    }))
    .pipe(gulp.dest(paths.dist));
}

// Compile SCSS
function compileScss() {
  return gulp.src(paths.src.scss)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([autoprefixer()]))
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(path.join(paths.dist, 'styles')));
}

// Copy static files
function copyStatic() {
  // Copy templates to the templates directory
  gulp.src('src/templates/**/*.hbs')
    .pipe(gulp.dest(path.join(paths.dist, 'templates')));

  // Copy language files
  gulp.src('src/lang/**/*.json')
    .pipe(gulp.dest(path.join(paths.dist, 'lang')));

  // Copy other static assets
  return gulp.src([
    'src/assets/**/*'
  ], { base: 'src' })
    .pipe(gulp.dest(paths.dist));
}

// Copy files from the root directory
function copyRootFiles() {
  return gulp.src(paths.src.root)
    .pipe(gulp.dest(paths.dist));
}

// Update system.json file paths to match the new structure
function updateSystemJson() {
  return gulp.src(`${paths.dist}/system.json`)
    .pipe(gulp.dest(paths.dist));
}

// Watch for changes
function watch() {
  gulp.watch(paths.src.ts, compileTS);
  gulp.watch(paths.src.scss, compileScss);
  gulp.watch(paths.src.static, copyStatic);
  gulp.watch(paths.src.root, copyRootFiles);
}

// Define complex tasks
const build = gulp.series(
  clean,
  gulp.parallel(compileTS, compileScss, copyStatic, copyRootFiles),
  updateSystemJson
);

// Export tasks
exports.clean = clean;
exports.build = build;
exports.watch = gulp.series(build, watch);
exports.default = build;

# Stage 1: Build the React application
FROM node:24-alpine AS build

WORKDIR /app

# Pin npm explicitly rather than trusting whatever ships with the base image. Different
# npm majors can disagree on what a lockfile's tree should look like for the same
# package.json — npm 10 rejected an npm 12-generated lockfile with "Missing: yaml@2.9.0
# from lock file" (npm 12 nests tailwindcss's postcss-load-config dependency where npm 10
# hoists it), even though nothing in the dependency graph had actually changed.
#
# The pin must therefore match whatever npm regenerates package-lock.json locally, or
# `npm ci` fails here on a lockfile that is perfectly valid on the dev machine. Node 24 +
# npm 12.0.2 mirrors the current local toolchain; npm 12 requires Node
# ^22.22.2 || ^24.15.0 || >=26, so the base image and this pin have to move together.
RUN npm install -g npm@12.0.2

# Copy package.json + lockfile to leverage Docker cache
COPY package.json package-lock.json ./

# Install exactly the versions pinned in package-lock.json. `npm install` (no lockfile
# copied) previously re-resolved every transitive dependency's semver range against
# whatever the registry serves at build time — safe until a package like dom-helpers
# ships a version incompatible with webpack's strict ESM resolution, which broke this
# build with no local change to explain it. `npm ci` is deterministic and also fails
# loudly if package.json and package-lock.json ever drift out of sync.
RUN npm ci

# Copy the rest of the application code
COPY . ./

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy the built application from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

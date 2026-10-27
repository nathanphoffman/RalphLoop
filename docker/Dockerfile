# ralph-base: the sandbox every loop runs in. Claude Code, git, python, node, and the shell tools the engine uses.
# Language toolchains go in a layer on top (Dockerfile.rust ...). Build: ralph docker build
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      git python3 curl ca-certificates procps jq pkg-config \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

# Same user id as the host so files in the mounted projects keep the right owner.
# (The node image already has a user with uid 1000: remove it first.)
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN (userdel -r node 2>/dev/null || true) \
 && (getent group ${HOST_GID} >/dev/null || groupadd -g ${HOST_GID} ralph) \
 && useradd -m -u ${HOST_UID} -g ${HOST_GID} -s /bin/bash ralph
USER ralph
ENV HOME=/home/ralph
WORKDIR /work

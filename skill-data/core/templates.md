---
name: core
description: Pipeline template patterns and best practices
---

# Pipeline Template Patterns

## Basic Three-Stage Pipeline

```yaml
stages: [build, test, deploy]

build:
  stage: build
  script: echo "Building..."

test:
  stage: test
  script: echo "Testing..."
  needs: [build]

deploy:
  stage: deploy
  script: echo "Deploying..."
  needs: [test]
  when: manual
```

## Multi-Stage with Approvals

```yaml
stages: [build, test, staging, production]

build:
  stage: build
  script: make build
  artifacts:
    paths: [dist/]

test:
  stage: test
  script: make test
  needs: [build]

deploy-staging:
  stage: staging
  script: make deploy-staging
  needs: [test]
  environment: staging

deploy-production:
  stage: production
  script: make deploy-production
  needs: [deploy-staging]
  when: manual
  environment: production
```

## Docker Build Pipeline

```yaml
stages: [build, test, push]

variables:
  IMAGE_TAG: $CI_COMMIT_SHORT_SHA

docker-build:
  stage: build
  image: docker:latest
  services: [docker:dind]
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$IMAGE_TAG .
    - docker tag $CI_REGISTRY_IMAGE:$IMAGE_TAG $CI_REGISTRY_IMAGE:latest

docker-test:
  stage: test
  script:
    - docker run $CI_REGISTRY_IMAGE:$IMAGE_TAG test
  needs: [docker-build]

docker-push:
  stage: push
  script:
    - docker push $CI_REGISTRY_IMAGE:$IMAGE_TAG
    - docker push $CI_REGISTRY_IMAGE:latest
  needs: [docker-test]
  only: [main]
```

## Best Practices

1. **Use needs explicitly**: Always declare job dependencies for clarity and performance
2. **Leverage artifacts**: Pass build outputs between stages instead of rebuilding
3. **Use rules over only/except**: `rules:` provides more flexible conditionals
4. **Cache dependencies**: Use `cache:` for package managers (npm, pip, maven)
5. **Keep stages parallel**: Design jobs within the same stage to run independently
6. **Use manual gates**: Mark deployment jobs as `when: manual` for production safety

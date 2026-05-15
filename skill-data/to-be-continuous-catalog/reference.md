---
name: to-be-continuous-catalog
description: Full reference for to-be-continuous GitLab CI/CD components
---

# to-be-continuous Component Reference

The [to-be-continuous](https://gitlab.com/to-be-continuous) organization
publishes GitLab CI/CD components organized by category. Each component
is available at `to-be-continuous/<name>`.

## Component categories

### Build

| Component | Path | Description |
|-----------|------|-------------|
| Bash | `to-be-continuous/bash` | Build Bash and shell code |
| .NET | `to-be-continuous/dotnet` | Build .NET applications |
| Go | `to-be-continuous/golang` | Build Go applications |
| Gradle | `to-be-continuous/gradle` | Build Gradle projects |
| GNU Make | `to-be-continuous/make` | Build with GNU Make |
| Maven | `to-be-continuous/maven` | Build Maven projects |
| Node.js | `to-be-continuous/node` | Build Node.js applications |
| PHP | `to-be-continuous/php` | Build PHP applications |
| Python | `to-be-continuous/python` | Build Python applications |
| Angular | `to-be-continuous/angular` | Build Angular applications |
| Rust | `to-be-continuous/rust` | Build Rust applications |
| sbt (Scala) | `to-be-continuous/sbt` | Build Scala projects |
| debian | `to-be-continuous/debian` | Build Debian packages |
| RPM | `to-be-continuous/rpm` | Build Red Hat packages |
| dbt | `to-be-continuous/dbt` | Build dbt data transformation projects |
| MkDocs | `to-be-continuous/mkdocs` | Build documentation sites |
| Sphinx | `to-be-continuous/sphinx` | Build Sphinx documentation |
| Zola | `to-be-continuous/zola` | Build Zola static sites |
| Source-to-Image | `to-be-continuous/s2i` | Source-to-Image packaging |

### Docker / Container image

| Component | Path | Description |
|-----------|------|-------------|
| Docker | `to-be-continuous/docker` | Build, test and scan container images (kaniko, Buildah or Docker) |
| Cloud Native Buildpacks | `to-be-continuous/cnb` | Build container images with CNB |
| Docker Compose | `to-be-continuous/docker-compose` | Deploy with Docker Compose |

### Testing

| Component | Path | Description |
|-----------|------|-------------|
| Bruno | `to-be-continuous/bruno` | API testing |
| Cypress | `to-be-continuous/cypress` | End-to-end testing |
| Hurl | `to-be-continuous/hurl` | HTTP API testing |
| k6 | `to-be-continuous/k6` | Load testing |
| Lighthouse CI | `to-be-continuous/lighthouse` | Performance testing |
| Playwright | `to-be-continuous/playwright` | Browser testing |
| Postman | `to-be-continuous/postman` | API testing |
| Puppeteer | `to-be-continuous/puppeteer` | Browser testing |
| Robot Framework | `to-be-continuous/robotframework` | Acceptance testing |
| UUV | `to-be-continuous/uuv` | Accessibility-driven E2E testing (WIP) |
| Test SSL | `to-be-continuous/testssl` | TLS/SSL compliancy testing |
| Spectral | `to-be-continuous/spectral` | API specification linting |
| SQLFluff | `to-be-continuous/sqlfluff` | SQL linting |
| pre-commit | `to-be-continuous/pre-commit` | Pre-commit hooks runner |

### SAST / Security

| Component | Path | Description |
|-----------|------|-------------|
| DefectDojo | `to-be-continuous/defectdojo` | Vulnerability management |
| Dependency-Track | `to-be-continuous/dependency-track` | Dependency analysis |
| Gitleaks | `to-be-continuous/gitleaks` | Secret detection |
| MobSF | `to-be-continuous/mobsf` | Mobile security framework |
| SonarQube | `to-be-continuous/sonar` | Code quality and SAST |

### Deployment

| Component | Path | Description |
|-----------|------|-------------|
| Amazon Web Services | `to-be-continuous/aws` | Deploy to AWS |
| Azure | `to-be-continuous/azure` | Deploy to Azure |
| Google Cloud Platform | `to-be-continuous/gcloud` | Deploy to GCP |
| Ansible | `to-be-continuous/ansible` | Ansible-based deployment |
| Cloud Foundry | `to-be-continuous/cloud-foundry` | Deploy to Cloud Foundry |
| GitOps | `to-be-continuous/gitops` | GitOps deployment trigger |
| Helm | `to-be-continuous/helm` | Deploy with Helm charts |
| Helmfile | `to-be-continuous/helmfile` | Deploy with Helmfile |
| Kubernetes | `to-be-continuous/kubernetes` | Deploy to Kubernetes |
| OpenShift | `to-be-continuous/openshift` | Deploy to OpenShift |
| S3 | `to-be-continuous/s3` | Deploy to S3 |
| Terraform | `to-be-continuous/terraform` | Infrastructure as Code |
| Docker Compose | `to-be-continuous/docker-compose` | Docker Compose deployment |
| Flux CD | `to-be-continuous/flux` | Flux CD deployment (WIP) |

### Release & Management

| Component | Path | Description |
|-----------|------|-------------|
| GitLab Package | `to-be-continuous/gitlab-package` | Publish to GitLab Package Registry |
| semantic-release | `to-be-continuous/semantic-release` | Automated release management |
| Renovate | `to-be-continuous/renovate` | Dependency update automation |
| gitlab-butler | `to-be-continuous/gitlab-butler` | GitLab group cleanup |
| ORT | `to-be-continuous/ort` | Open-source compliance check |
| Microcks | `to-be-continuous/microcks` | API mocking (WIP) |

## Versioning

Components are versioned independently. Default latest version is `~latest`.
Use `--version <tag>` with schema/inputs commands for a specific version:

```bash
gitlab-catalog-browser component inputs to-be-continuous/docker --version 8.3.0
```

## Naming convention

- Component names use kebab-case in URLs: `to-be-continuous/docker`, `to-be-continuous/helmfile`
- Jobs follow the pattern: `<org>-<component>-<suffix>` (e.g. `to-be-continuous-docker-build`)
- Inputs follow the pattern: `<component>-<name>` (e.g. `docker-image`, `sonar-project-key`)

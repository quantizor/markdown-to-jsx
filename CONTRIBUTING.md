# Contributing to markdown-to-jsx

First, welcome and thanks so much for your interest in helping to make this library the best it can be!

markdown-to-jsx is a fork of another library called [simple-markdown](https://github.com/Khan/simple-markdown), and has been heavily modified to support React-specific use cases. Here are some general guidelines of what this library looks to solve:

- Very lightweight bundle size (most markdown implementations are huge)
- Support GitHub-flavor markdown (Daring Fireball Markdown + some special stuff like task lists and tables)
- Configurable, but not at the cost of bundle size or ease of use in the 99% case
- Support rendering arbitrary HTML in markdown

Anything that falls outside of those goals is unlikely to be added to the library, just to set the right expectation.

## Writing a PR

A good pull request should include a description of the change, any relevant links (security advisories, reproduction sandbox, github issue), and at least one test. We're not aiming for 100% coverage, but try to add tests for the various angles that your code might be hit from including unhappy paths.

## Cutting a release

markdown-to-jsx uses semantic versioning. If you're releasing a bugfix, a PATCH version (x.x.X) is sufficient. For new functionality, a MINOR version is warranted (x.X.0). Finally, breaking changes should release a MAJOR version (X.0.0). All maintainers should sign off on breaking changes to ensure they've been thought-through appropriately.

Use the `yarn publish` command to automate the process of building the JS and website, and defining the new version string. Once publish is complete, amend the rebuilt site JS (`git add . && git commit --amend`) and push to main.

Then go to the GitHub Releases panel and add a new one with the same version number. Copy and paste the relevant commits from git history with links to the pull requests and make sure you thank the contributor that added them.

## Code of Conduct

markdown-to-jsx is maintained by a diverse team and seeks to maintain a healthy, inclusive environment for contributors. Any slurs, hate speech, or other aggressions of that nature will not be tolerated and the relevant parties will be blocked from the repository. Zero exceptions, be professional.

Finally, please realize that this library is maintained by community volunteers. We are not compensated for our time and entitlement behavior will not be tolerated. You won't be blocked for acting this way, but don't expect a response.

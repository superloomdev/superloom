# To access private github packages
* Create .npmrc file in _test folder
* Copy following code in .npmrc file
```
@username:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=PERSONAL_ACCESS_TOKEN
```
* Replace @username with your GitHub username and PERSONAL_ACCESS_TOKEN with your GitHub personal access token.

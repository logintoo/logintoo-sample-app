# Logintoo Sample App

The demo website: [sample.logintoo.com](https://sample.logintoo.com)

This is a sample application to demonstrate how the Logintoo **passwordless authentication** service works.

Log in with your email address. We will not save your address, it will only be used once to send you an access code. Please do not use other people's emails.

A **one-time access code** will be emailed to you. Use it to get access to the sample data. No password required.

When logged in, if you are lucky enough you should see the content of the JWT access token received from the Authorization Server.

The **/html** folder contains the static website files. Customize parameters in **/html/js/index.js**:

- **client_id**: ID of your application registered on the Authorization Server.
- **redirect_uri**: Redirection endpoint URI.
- **authServer**: Authorization Server domain name.
- **authApiVersion**: Version of the Authorization Server API.
- **appApiUri**: The application API endpoint .

The **/aws-cdk** folder contains everything you need to deploy Sample App API into AWS infrastructure using [AWS Cloud Development Kit](https://aws.amazon.com/cdk/) (AWS CDK).

*The static website utilizes [jQuery](https://jquery.com) and [Materialize](https://materializecss.com).*
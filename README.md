# Logintoo Sample App

The demo website: [sample.logintoo.com](https://sample.logintoo.com)

This is a sample application to demonstrate how the Logintoo **passwordless authentication** service works.

The sample application redirects user to the Authorization Server, receives an Access Token and a Refresh Token, then uses the Access Token to retrieve information from the Sample API. The API validates and reads the content of the Access Token and just returns it back to the app.

The Sample App also refreshes the Access Token and rotates the Refresh Token.

The **/html** folder contains the static website files. Customize parameters in **/html/js/index.js**:

- **client_id**: ID of your application registered on the Authorization Server.
- **redirect_uri**: Redirection endpoint URI.
- **authServer**: Authorization Server domain name.
- **authApiVersion**: Version of the Authorization Server API.
- **appApiUri**: The application API endpoint .

The **/aws-cdk** folder contains everything you need to deploy Sample App API into AWS infrastructure using [AWS Cloud Development Kit](https://aws.amazon.com/cdk/) (AWS CDK). This stack describes a Sample API to be deployed in AWS API Gateway with an authorizer Lambda function.

Customize parameters in **/aws-cdk/sample-api/lib/sample-api-stack.js**:

- **tokenIssuer**: The expected 'iss' claim of the Access Token, identifies the principal that issued the JWT.
- **tokenAud**: The 'aud' (audience) claim of the Access Token, the recipient that the JWT is intended for.
- **apiDomain**: API domain name in case you want to use a custom domain name.
- **certificateArn**: The AWS ARN of your Certificate in case you want to use a custom domain name (you can use an AWS domain name instead).

You need an AWS account to deploy the API.

*The static website utilizes [jQuery](https://jquery.com) and [Materialize](https://materializecss.com).*
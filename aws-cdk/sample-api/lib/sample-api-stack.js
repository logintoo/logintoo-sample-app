'use strict';
const Config = require('./Config.js');

const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const apigw = require('@aws-cdk/aws-apigateway');
const iam = require('@aws-cdk/aws-iam');
const { Certificate } = require('@aws-cdk/aws-certificatemanager');

class SampleApiStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Tag all resources.
    const tags = setTags();
    for (let tag of tags) {
      cdk.Tags.of(this).add(tag.key, tag.value);
    }

    const authorizerRolePolicy = new iam.Policy(this, 'authorizerRolePolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['kms:Verify'],
          effect: iam.Effect.ALLOW,
          resources: ['arn:aws:kms:*:*:key/*']
        }),
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          effect: iam.Effect.ALLOW,
          resources: ['*']
        }),
      ]
    });
    const authorizerRole = new iam.Role(this, 'authorizerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {'allowKmsVerify': authorizerRolePolicy.document}
    });

    const authorizerLambda = new lambda.Function(this, 'authorizerLambda', {
      functionName: 'logintoo-sample-api-authorizer',
      code: new lambda.AssetCode('lambda'),
      handler: 'authorizer.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Authorizer for Logintoo Sample App API.',
      memorySize: 128,
      timeout: cdk.Duration.seconds(3),
      role: authorizerRole,
      environment: {
        TOKEN_ISS: Config.TOKEN_ISS,
        TOKEN_AUD: Config.TOKEN_AUD
      }
    });

    const apiParams = {
      description: 'Logintoo Sample App API.'
    };
    if (Config.USE_CUSTOM_DOMAIN) {
      apiParams.domainName = {
        certificate: Certificate.fromCertificateArn(this, 'certificate', Config.CERTIFICATE_ARN),
        domainName: Config.API_DOMAIN_NAME,
        endpointType: apigw.EndpointType.EDGE,
        securityPolicy: apigw.SecurityPolicy.TLS_1_2
      };
    }
    const api = new apigw.RestApi(this, 'logintoo-sample-app', apiParams);

    const resource = api.root.addResource('token-data');

    new apigw.GatewayResponse(this, 'logintoo-4xx', {
      restApi: api,
      type: apigw.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'"
      },
      templates: {
        'application/json': '\
        {\n\
          \"statusCode\": \"$context.authorizer.statusCode\",\n\
          \"statusText\": \"$context.authorizer.statusText\"\n\
        }'
      }
    });
    new apigw.GatewayResponse(this, 'logintoo-401', {
      restApi: api,
      type: apigw.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'"
      },
      templates: {
        'application/json': '\
        {\n\
          \"statusCode\": \"401\",\n\
          \"statusText\": \"Unauthorized\"\n\
        }'
      }
    });

    const integration = new apigw.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
          responseTemplates: {
            // Cannot use JSON.stringify here because of special symbols.
            'application/json': ' \
            {\n \
              #foreach($key in $context.authorizer.keySet())\n \
                \"$key\" : \"$util.escapeJavaScript($context.authorizer.get($key))\",\n \
              #end\n \
              \"statusCode\": 200,\n \
              \"statusText\": \"200 OK\"\n \
            }'
          }
        }
      ],
      passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {
        'application/json': JSON.stringify({statusCode: 200})
      },
    });

    resource.addMethod('GET', integration, {
      authorizationType: apigw.AuthorizationType.CUSTOM,
      authorizer: new apigw.TokenAuthorizer(this, 'loginto-sample-app-authorizer', {
        handler: authorizerLambda,
        authorizerName: 'loginto-sample-app-authorizer',
        validationRegex: '^(?i)Bearer(?-i)\\s.+'
      }),
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '403',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    resource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET']
    });

  }
}

function setTags() {
  const tags = [];

  // Full path to the working directory.
  const pwd = process.env.PWD;
  if (pwd) {
    tags.push({
      key: 'Working Directory',
      value: pwd
    });
  }

  // Use the owner tag for known accounts or the OS username.
  const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;

  tags.push({
    key: 'Owner',
    value: (Config.KNOWN_AWS_ACCOUNTS[awsAccount]) ? Config.KNOWN_AWS_ACCOUNTS[awsAccount].ownerTag : process.env.USER
  });

  return tags;
}

module.exports = { SampleApiStack }

#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { SampleApiStack } = require('../lib/sample-api-stack');

const app = new cdk.App();
new SampleApiStack(app, 'SampleApiStack');

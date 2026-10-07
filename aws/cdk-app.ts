// AWS CDK app — Live Diligence agent on Lambda + Bedrock.
// Mirrors the Lovable serverless runtime as an alternate, Top-5 qualifying path.

import { App, Stack, Duration, RemovalPolicy, type StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwint from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import { BEDROCK_INVOKE_ACTIONS, DEFAULT_BEDROCK_REGION, NOVA_BEDROCK_RESOURCES, resolveBedrockModelId } from "./lambda/model";

export class LiveDiligenceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const reports = new ddb.Table(this, "ReportsTable", {
      partitionKey: { name: "id", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    const events = new ddb.Table(this, "EventsTable", {
      partitionKey: { name: "report_id", type: ddb.AttributeType.STRING },
      sortKey: { name: "created_at", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const exaSecret = new sm.Secret(this, "ExaApiKey", { secretName: "live-diligence/exa-api-key" });
    const stripeSecret = new sm.Secret(this, "StripeSecret", { secretName: "live-diligence/stripe-secret" });

    // Resolving here makes `cdk synth` fail before an anthropic.* override is baked into the function.
    const bedrockModelId = resolveBedrockModelId(process.env.BEDROCK_MODEL_ID);

    const fn = new nodejs.NodejsFunction(this, "AgentRunner", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "./lambda/runner.ts",
      timeout: Duration.seconds(90),
      memorySize: 1024,
      environment: {
        REPORTS_TABLE: reports.tableName,
        EVENTS_TABLE: events.tableName,
        EXA_SECRET_ARN: exaSecret.secretArn,
        STRIPE_SECRET_ARN: stripeSecret.secretArn,
        BEDROCK_MODEL_ID: bedrockModelId,
        AIRBYTE_WORKSPACE: process.env.AIRBYTE_WORKSPACE || "default",
      },
    });

    reports.grantReadWriteData(fn);
    events.grantReadWriteData(fn);
    exaSecret.grantRead(fn);
    stripeSecret.grantRead(fn);

    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [...BEDROCK_INVOKE_ACTIONS],
      resources: [...NOVA_BEDROCK_RESOURCES],
    }));

    const api = new apigwv2.HttpApi(this, "AgentApi", {
      corsPreflight: { allowOrigins: ["*"], allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.GET] },
    });
    api.addRoutes({
      path: "/run-report",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwint.HttpLambdaIntegration("RunnerInt", fn),
    });
  }
}

const app = new App();
new LiveDiligenceStack(app, "LiveDiligenceStack", { env: { region: process.env.AWS_REGION || DEFAULT_BEDROCK_REGION } });

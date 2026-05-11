# AWS VPC and Security Group Setup

## Prerequisites

AWS account active.

## Steps

### Lambda Networking Decision

Choose whether Lambda functions belong to a VPC or not:

**Option A: Lambda Outside VPC (Recommended)**
* Lambda functions are outside the security group - no networking limitations
* Drawback: Cannot access services limited inside a security group (e.g., RDS must enable public access)
* Benefit: No need for separate NAT Gateway and Elastic IP for internet access
* Lower cost and simpler configuration

**Option B: Lambda Inside VPC**
* Requires adequate IP address supply in subnets - Lambda will fail to scale if insufficient
* Use at least one subnet per Availability Zone for high availability
* Requires NAT Gateway or NAT Instance for internet access from private subnets
* Lambda execution role needs permissions: `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface`

### Security Group Configuration

If using a VPC:

* EC2 → Security Groups → Create Security Group
* Name: `[TODO: project]-[stage]-sg`
* VPC: `[TODO: Select VPC]`
* Inbound Rules:
  * `[TODO: Define based on requirements]`
* Outbound Rules:
  * Allow all outbound traffic (default)

## Notes

- For most serverless projects, Option A (Lambda outside VPC) is recommended
- If RDS is required with Lambda outside VPC, RDS must allow public access with strong security group rules
- Document the chosen approach here for future reference

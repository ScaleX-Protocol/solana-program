# Deploy OpenBook Indexer to Production Server

## Server Information
- **Server IP**: 152.53.225.25
- **Portainer**: https://portainer.scalex.money/
- **Target URL**: https://solana-devnet-indexer.scalex.money

## Prerequisites on Server

### 1. Ensure Infrastructure is Running

```bash
ssh root@152.53.225.25

# Check infrastructure services
docker ps | grep -E "traefik|postgres|redis"

# If Traefik is not running, start it
# (Should already exist from base-sepolia setup)
```

### 2. Add Cloudflare Token to Traefik

The Traefik instance needs the Cloudflare API token for DNS-01 challenge:

**Token**: `AA354AVGxsmFCH8WhV0EqcVRLK_QIyYXwk_NoqNn`

**Option A: Via Docker Environment**
```bash
# Find Traefik container
docker ps | grep traefik

# Update with environment variable
docker stop traefik
docker rm traefik

# Recreate with Cloudflare token
# (Use existing docker-compose with added environment variable)
```

**Option B: Via Portainer**
1. Go to https://portainer.scalex.money/
2. Login: dev@scalex.money / newpassword123
3. Navigate to traefik container
4. Add environment variable: `CF_API_TOKEN=AA354AVGxsmFCH8WhV0EqcVRLK_QIyYXwk_NoqNn`
5. Recreate container

### 3. Configure DNS Records

Add these A records in Cloudflare:
```
solana-devnet-indexer.scalex.money → 152.53.225.25
solana-mainnet-indexer.scalex.money → 152.53.225.25
```

## Deployment Steps

### Method 1: Using Git on Server (Recommended)

```bash
# SSH to server
ssh root@152.53.225.25

# Clone or pull latest code
cd /root
git clone git@github.com:ScaleX-Protocol/solana-program.git openbook
# OR if already cloned:
cd /root/openbook && git pull origin main

# Set environment
export NETWORK=devnet

# Deploy using simple compose file
docker-compose -f docker-compose.simple.yml -p solana-devnet up -d --build
```

### Method 2: Using Portainer Stacks

1. Go to **Portainer** → **Stacks** → **Add Stack**
2. Name: `solana-devnet-indexer`
3. Build method: **Repository**
   - Repository URL: `https://github.com/ScaleX-Protocol/solana-program`
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.simple.yml`
4. Environment variables:
   ```
   NETWORK=devnet
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=password
   OPENBOOK_DATABASE=openbook_devnet
   SOLANA_RPC_URL=https://api.devnet.solana.com
   ```
5. Click **Deploy**

### Method 3: Manual Docker Build

```bash
# On your local machine, build and export
cd /Users/renaka/gtx/openbook
docker build -f Dockerfile.simple -t solana-indexer:latest .
docker save solana-indexer:latest | gzip > solana-indexer.tar.gz

# Copy to server
scp solana-indexer.tar.gz root@152.53.225.25:/root/

# On server
ssh root@152.53.225.25
cd /root
docker load < solana-indexer.tar.gz

# Run with compose
export NETWORK=devnet
docker-compose -f docker-compose.simple.yml -p solana-devnet up -d
```

## Verification

### 1. Check Container Status

```bash
docker ps | grep solana-devnet-indexer
docker logs solana-devnet-indexer
```

### 2. Check Traefik Routes

```bash
# Check if Traefik detected the service
docker logs traefik | grep solana-devnet

# Or via Traefik dashboard
open http://152.53.225.25:8080
```

### 3. Test Public Access

```bash
# Test HTTP → HTTPS redirect
curl -I http://solana-devnet-indexer.scalex.money

# Test HTTPS endpoint
curl https://solana-devnet-indexer.scalex.money/health

# Should return 200 OK with health status
```

### 4. Check SSL Certificate

```bash
openssl s_client -connect solana-devnet-indexer.scalex.money:443 -servername solana-devnet-indexer.scalex.money < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Issuer"

# Should show: Let's Encrypt Authority
```

## Troubleshooting

### Issue: 404 Not Found

```bash
# Check if container is running
docker ps | grep solana-devnet-indexer

# Check Traefik labels
docker inspect solana-devnet-indexer | grep -A20 Labels

# Restart Traefik to re-detect
docker restart traefik
```

### Issue: 502 Bad Gateway

```bash
# Check indexer logs
docker logs solana-devnet-indexer

# Check if port 42090 is responding
docker exec solana-devnet-indexer curl -f http://localhost:42090/health
```

### Issue: SSL Certificate Error

```bash
# Check Traefik logs for ACME errors
docker logs traefik | grep -i acme

# Verify DNS is propagated
nslookup solana-devnet-indexer.scalex.money

# Restart Traefik to retry certificate
docker restart traefik
```

## Expected Result

✅ **Public URL**: https://solana-devnet-indexer.scalex.money
✅ **Health Check**: https://solana-devnet-indexer.scalex.money/health
✅ **SSL Certificate**: Valid Let's Encrypt certificate
✅ **HTTP → HTTPS**: Automatic redirect

---

## Quick Deploy Command

```bash
# One-liner for server deployment
ssh root@152.53.225.25 'cd /root/openbook && git pull && export NETWORK=devnet && docker-compose -f docker-compose.simple.yml -p solana-devnet up -d --build'
```

## Rollback

```bash
# Stop indexer
docker-compose -f docker-compose.simple.yml -p solana-devnet down

# Remove images
docker rmi solana-indexer:latest
```

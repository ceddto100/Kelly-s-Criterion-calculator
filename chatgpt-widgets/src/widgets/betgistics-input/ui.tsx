/**
 * Betgistics Input Widget (ChatGPT Widget Builder compatible)
 *
 * Drop this JSX into the Widget Builder "Code" tab. It wires to the
 * analyze_matchup_and_log_bet MCP tool and exposes bankroll/odds/Kelly/userId/logBet
 * with tasteful styling.
 */

<Card
  size="sm"
  variant="ghost"
  padding={3}
  radius="lg"
  style={{
    background: 'linear-gradient(145deg, #0b1220 0%, #050510 50%, #0f172a 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow:
      '0 18px 50px rgba(6, 182, 212, 0.18), 0 8px 24px rgba(59, 130, 246, 0.14), inset 0 0 0 1px rgba(255,255,255,0.02)',
    width: '706px',
    maxWidth: '706px',
    minHeight: '600px',
    maxHeight: '860px',
    overflowY: 'auto',
    margin: '0 auto'
  }}
>
  <Col gap={3}>
    <Row align="center" gap={2}>
      <Icon name="analytics" size="lg" color="primary" />
      <Title
        value="Betgistics"
        size="md"
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}
      />
      <Badge
        label="Widget Agent"
        variant="solid"
        tone="primary"
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
          color: '#0b1220',
          fontWeight: 700
        }}
      />
      <Spacer />
      <Badge
        label="Edge + Kelly"
        variant="soft"
        tone="secondary"
        style={{
          background: 'color-mix(in srgb, #3b82f6 20%, transparent)',
          color: '#8bafff'
        }}
      />
    </Row>

    <Text
      value="Paste a short game note; we’ll parse, price, and size the bet."
      size="sm"
      color="secondary"
      style={{ color: 'rgba(226, 232, 240, 0.8)' }}
    />

    <Divider style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)', height: 2 }} />

  <Form onSubmitAction={{ type: "analyze_matchup_and_log_bet" }}>
    <Col gap={3}>
      <Textarea
        name="userText"
        defaultValue={initialUserText}
          required
          rows={3}
          placeholder="e.g., NBA: Lakers vs Warriors, Lakers -3.5, odds -115, bankroll 2k"
          autoResize
          maxRows={6}
          variant="filled"
        />

        <Row gap={2}>
          <Input
            name="bankroll"
            inputType="number"
            placeholder="Bankroll ($, optional)"
            defaultValue={initialBankroll}
            prefix="$"
            variant="soft"
            step="1"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0'
            }}
          />
          <Input
            name="americanOdds"
            inputType="number"
            placeholder="Odds (e.g., -110)"
            defaultValue={initialOdds}
            variant="soft"
            step="1"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0'
            }}
          />
        </Row>

        <Row gap={2} wrap>
          <Select
            name="kellyFraction"
            options={[
              { label: "Quarter Kelly (0.25)", value: 0.25 },
              { label: "Half Kelly (0.5)", value: 0.5 },
              { label: "Full Kelly (1.0)", value: 1.0 }
            ]}
            defaultValue={defaultKelly}
            pill
            variant="soft"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#e2e8f0'
            }}
          />
          <Input
            name="userId"
            placeholder="User ID/handle (optional)"
            defaultValue={initialUserId}
            variant="soft"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0'
            }}
          />
          <Checkbox
            name="logBet"
            label="Log bet"
            defaultChecked={defaultLogBet}
            helperText="Store in history if DB is connected"
            style={{ color: '#e2e8f0' }}
          />
        </Row>

        <Row align="center" gap={2}>
          <Text size="xs" color="secondary">
            Defaults: bankroll $1,000 • odds -110 • Half Kelly if omitted.
          </Text>
          <Spacer />
          <Button
            submit
            label="Analyze"
            style="primary"
            iconStart="sparkle"
            size="md"
            variant="glow"
            fullWidth
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
              color: '#0b1220',
              boxShadow: '0 14px 32px rgba(59, 130, 246, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04)'
            }}
          />
        </Row>
      </Col>
    </Form>
  </Col>
</Card>
